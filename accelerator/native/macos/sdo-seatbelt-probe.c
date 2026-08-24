#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <signal.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

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

static bool enforced_child(pid_t child) {
  int status = 0;
  if (child < 0 || waitpid(child, &status, 0) != child) return false;
  if (WIFEXITED(status)) return WEXITSTATUS(status) == 0;
  if (!WIFSIGNALED(status)) return false;
  const int signal_number = WTERMSIG(status);
  return signal_number == SIGABRT || signal_number == SIGKILL ||
    signal_number == SIGSYS;
}

static bool read_is_denied(const char *target, bool missing_is_denied) {
  const pid_t child = fork();
  if (child == 0) {
    const int descriptor = open(target, O_RDONLY);
    if (descriptor >= 0) {
      close(descriptor);
      _exit(1);
    }
    _exit(denied(errno) || (missing_is_denied && errno == ENOENT) ? 0 : 1);
  }
  return enforced_child(child);
}

static bool workspace_write_is_denied(const char *workspace) {
  char target[PATH_MAX];
  const int length = snprintf(
    target, sizeof(target), "%s/.sdo-seatbelt-probe", workspace
  );
  if (length < 0 || (size_t) length >= sizeof(target)) return false;
  const pid_t child = fork();
  if (child == 0) {
    const int descriptor = open(target, O_WRONLY | O_CREAT | O_EXCL, 0600);
    if (descriptor >= 0) {
      close(descriptor);
      _exit(1);
    }
    _exit(denied(errno) ? 0 : 1);
  }
  return enforced_child(child);
}

static bool network_is_denied(void) {
  const pid_t child = fork();
  if (child == 0) {
    const int descriptor = socket(AF_INET, SOCK_STREAM, 0);
    if (descriptor < 0) _exit(denied(errno) ? 0 : 1);
    struct timeval timeout = { .tv_sec = 1, .tv_usec = 0 };
    (void) setsockopt(
      descriptor, SOL_SOCKET, SO_SNDTIMEO, &timeout, sizeof(timeout)
    );
    struct sockaddr_in address;
    memset(&address, 0, sizeof(address));
    address.sin_family = AF_INET;
    address.sin_port = htons(53);
    if (inet_pton(AF_INET, "1.1.1.1", &address.sin_addr) != 1) _exit(1);
    const int connected = connect(
      descriptor, (const struct sockaddr *) &address, sizeof(address)
    );
    const int error = errno;
    close(descriptor);
    _exit(connected < 0 && denied(error) ? 0 : 1);
  }
  return enforced_child(child);
}

static bool generic_process_is_denied(void) {
  const pid_t child = fork();
  if (child == 0) {
    execl("/bin/sh", "sh", "-c", "exit 42", (char *) NULL);
    _exit(denied(errno) ? 0 : 1);
  }
  return enforced_child(child);
}

int main(int argc, char **argv) {
  if (argc != 5 || argv[1][0] == '\0' || !valid_fingerprint(argv[2]) ||
      argv[3][0] == '\0' || argv[4][0] == '\0' || !minimal_environment()) return 1;
  char current[PATH_MAX];
  if (getcwd(current, sizeof(current)) == NULL || strcmp(current, argv[3]) != 0) return 1;
  if (!workspace_write_is_denied(argv[3])) return 1;
  if (!read_is_denied("/etc/passwd", false)) return 1;
  if (!read_is_denied(argv[4], true)) return 1;
  if (!network_is_denied()) return 1;
  if (!generic_process_is_denied()) return 1;
  return 0;
}
