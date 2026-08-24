#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <unistd.h>

#ifdef __APPLE__
#include <sandbox.h>
#else
static int sandbox_init(const char *profile, unsigned long long flags, char **error) {
  (void) profile;
  (void) flags;
  (void) error;
  return -1;
}
static void sandbox_free_error(char *error) {
  (void) error;
}
#endif

extern char **environ;

#ifndef PATH_MAX
#define PATH_MAX 4096
#endif

static bool denied(int error) {
  return error == EACCES || error == EPERM;
}

static bool valid_fingerprint(const char *value) {
  if (value == NULL || strlen(value) != 64) return false;
  for (size_t index = 0; index < 64; index += 1) {
    const char character = value[index];
    if (!((character >= '0' && character <= '9') ||
          (character >= 'a' && character <= 'f'))) return false;
  }
  return true;
}

static bool minimal_environment(void) {
  for (char **entry = environ; entry != NULL && *entry != NULL; entry += 1) {
    if (strncmp(*entry, "PATH=", 5) != 0 &&
        strncmp(*entry, "HOME=", 5) != 0 &&
        strncmp(*entry, "PWD=", 4) != 0) return false;
  }
  return true;
}

static bool apply_seatbelt(const char *profile) {
  char *error = NULL;
  const int status = sandbox_init(profile, 0, &error);
  if (error != NULL) sandbox_free_error(error);
  return status == 0;
}

static bool read_is_denied(const char *target, bool missing_is_denied) {
  const int descriptor = open(target, O_RDONLY);
  if (descriptor >= 0) {
    close(descriptor);
    return false;
  }
  return denied(errno) || (missing_is_denied && errno == ENOENT);
}

static bool workspace_write_is_denied(const char *workspace) {
  char target[PATH_MAX];
  const int length = snprintf(
    target, sizeof(target), "%s/.sdo-seatbelt-probe", workspace
  );
  if (length < 0 || (size_t) length >= sizeof(target)) return false;
  const int descriptor = open(target, O_WRONLY | O_CREAT | O_EXCL, 0600);
  if (descriptor >= 0) {
    close(descriptor);
    return false;
  }
  return denied(errno);
}

static bool network_is_denied(void) {
  const int descriptor = socket(AF_INET, SOCK_STREAM, 0);
  if (descriptor < 0) return denied(errno);
  struct timeval timeout = { .tv_sec = 1, .tv_usec = 0 };
  (void) setsockopt(descriptor, SOL_SOCKET, SO_SNDTIMEO, &timeout, sizeof(timeout));
  struct sockaddr_in address;
  memset(&address, 0, sizeof(address));
  address.sin_family = AF_INET;
  address.sin_port = htons(53);
  if (inet_pton(AF_INET, "1.1.1.1", &address.sin_addr) != 1) return false;
  const int connected = connect(
    descriptor, (const struct sockaddr *) &address, sizeof(address)
  );
  const int error = errno;
  close(descriptor);
  return connected < 0 && denied(error);
}

static bool generic_process_is_denied(void) {
  execl("/bin/sh", "sh", "-c", "exit 42", (char *) NULL);
  return denied(errno);
}

int main(int argc, char **argv) {
  if (argc != 7 || argv[1][0] == '\0' || !valid_fingerprint(argv[2]) ||
      argv[3][0] == '\0' || argv[4][0] == '\0' || argv[5][0] == '\0' ||
      argv[6][0] == '\0' || !minimal_environment()) return 1;
  char current[PATH_MAX];
  if (getcwd(current, sizeof(current)) == NULL || strcmp(current, argv[3]) != 0 ||
      !apply_seatbelt(argv[6])) return 1;
  if (strcmp(argv[5], "bootstrap") == 0) return 0;
  if (strcmp(argv[5], "workspace-write") == 0)
    return workspace_write_is_denied(argv[3]) ? 0 : 1;
  if (strcmp(argv[5], "workspace-boundary") == 0)
    return read_is_denied("/etc/passwd", false) ? 0 : 1;
  if (strcmp(argv[5], "secret-read") == 0)
    return read_is_denied(argv[4], true) ? 0 : 1;
  if (strcmp(argv[5], "network") == 0) return network_is_denied() ? 0 : 1;
  if (strcmp(argv[5], "generic-process") == 0)
    return generic_process_is_denied() ? 0 : 1;
  return 1;
}
