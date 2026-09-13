#define _GNU_SOURCE

#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <poll.h>
#include <signal.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

#define PROVIDER_PORT 43127
#define BUFFER_SIZE 32768
#define BROKER_CHANNEL_COUNT 8

static volatile sig_atomic_t forwarded_signal = 0;
static pid_t sandbox_pid = -1;

static void handle_signal(int signal_number) {
  forwarded_signal = signal_number;
  if (sandbox_pid > 0) {
    (void)kill(sandbox_pid, signal_number);
  }
}

static const char *prepare_cognitive_child(void) {
  if (chdir("/cognitive/workspace") != 0) return "chdir";
  if (setenv("PWD", "/cognitive/workspace", 1) != 0) return "environment";
  return NULL;
}

static int validate_provider_socket(const char *socket_path, uid_t expected_uid) {
  size_t socket_path_length = socket_path == NULL ? 0 : strlen(socket_path);
  if (socket_path == NULL || socket_path[0] != '/' || socket_path_length < 14 ||
      socket_path_length >= 100 || strstr(socket_path, "/../") != NULL ||
      strcmp(socket_path + socket_path_length - 14,
      "/provider.sock") != 0) return -1;
  struct stat status;
  if (lstat(socket_path, &status) != 0 || !S_ISSOCK(status.st_mode) ||
      status.st_uid != expected_uid || (status.st_mode & 0177) != 0) return -1;
  return 0;
}

static int create_loopback_listener(void) {
  int descriptor = socket(AF_INET, SOCK_STREAM | SOCK_CLOEXEC, 0);
  if (descriptor < 0) return -1;
  struct sockaddr_in address;
  memset(&address, 0, sizeof(address));
  address.sin_family = AF_INET;
  address.sin_port = htons(PROVIDER_PORT);
  address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  if (bind(descriptor, (struct sockaddr *)&address, sizeof(address)) != 0 ||
      listen(descriptor, 4) != 0) {
    close(descriptor);
    return -1;
  }
  return descriptor;
}

static int connect_provider_socket(const char *socket_path) {
  int descriptor = socket(AF_UNIX, SOCK_STREAM | SOCK_CLOEXEC, 0);
  if (descriptor < 0) return -1;
  struct sockaddr_un {
    sa_family_t sun_family;
    char sun_path[108];
  } address;
  memset(&address, 0, sizeof(address));
  address.sun_family = AF_UNIX;
  size_t length = strlen(socket_path);
  if (length >= sizeof(address.sun_path)) {
    close(descriptor);
    return -1;
  }
  memcpy(address.sun_path, socket_path, length + 1);
  if (connect(descriptor, (struct sockaddr *)&address,
      offsetof(struct sockaddr_un, sun_path) + length + 1) != 0) {
    close(descriptor);
    return -1;
  }
  return descriptor;
}

static int wait_for_broker_removal(const char *socket_path) {
  struct stat status;
  for (int attempt = 0; attempt < 5000; attempt += 1) {
    if (lstat(socket_path, &status) != 0) {
      return errno == ENOENT ? 0 : -1;
    }
    usleep(1000);
  }
  return -1;
}

static int write_all(int descriptor, const char *buffer, size_t length) {
  size_t offset = 0;
  while (offset < length) {
    ssize_t written = write(descriptor, buffer + offset, length - offset);
    if (written < 0) {
      if (errno == EINTR) continue;
      return -1;
    }
    offset += (size_t)written;
  }
  return 0;
}

static void bridge_connection(int client, int provider) {
  int client_open = 1;
  int provider_open = 1;
  char buffer[BUFFER_SIZE];
  while ((client_open || provider_open) && forwarded_signal == 0) {
    struct pollfd descriptors[2] = {
      { .fd = client, .events = client_open ? POLLIN : 0, .revents = 0 },
      { .fd = provider, .events = provider_open ? POLLIN : 0, .revents = 0 }
    };
    int result = poll(descriptors, 2, 1000);
    if (result < 0) {
      if (errno == EINTR) continue;
      break;
    }
    if (descriptors[0].revents & (POLLIN | POLLHUP)) {
      ssize_t length = read(client, buffer, sizeof(buffer));
      if (length <= 0 || write_all(provider, buffer, (size_t)length) != 0) {
        client_open = 0;
        shutdown(provider, SHUT_WR);
      }
    }
    if (descriptors[1].revents & (POLLIN | POLLHUP)) {
      ssize_t length = read(provider, buffer, sizeof(buffer));
      if (length <= 0 || write_all(client, buffer, (size_t)length) != 0) {
        provider_open = 0;
        shutdown(client, SHUT_WR);
      }
    }
    if ((descriptors[0].revents & (POLLERR | POLLNVAL)) != 0 ||
        (descriptors[1].revents & (POLLERR | POLLNVAL)) != 0) break;
  }
}

static int run_relay(int listener, int broker_channels[BROKER_CHANNEL_COUNT],
    int broker_channel_count) {
  int sandbox_status = 1;
  int next_broker_channel = 0;
  for (;;) {
    pid_t result = waitpid(sandbox_pid, &sandbox_status, WNOHANG);
    if (result == sandbox_pid) break;
    if (result < 0 && errno != EINTR) return 1;
    struct pollfd descriptor = { .fd = listener, .events = POLLIN, .revents = 0 };
    int ready = poll(&descriptor, 1, 100);
    if (ready < 0) {
      if (errno == EINTR) continue;
      return 1;
    }
    if (ready > 0 && (descriptor.revents & POLLIN) != 0) {
      int client = accept4(listener, NULL, NULL, SOCK_CLOEXEC);
      if (client < 0) continue;
      if (next_broker_channel < broker_channel_count) {
        int provider = broker_channels[next_broker_channel++];
        broker_channels[next_broker_channel - 1] = -1;
        bridge_connection(client, provider);
        close(provider);
      }
      close(client);
    }
  }
  if (WIFEXITED(sandbox_status)) return WEXITSTATUS(sandbox_status);
  if (WIFSIGNALED(sandbox_status)) return 128 + WTERMSIG(sandbox_status);
  return 1;
}

int main(int argc, char **argv) {
  if (argc < 4 || strcmp(argv[2], "--") != 0 ||
      (strcmp(argv[3], "/runtime/codex") != 0 &&
      strcmp(argv[3], "/runtime/node") != 0) ||
      (strcmp(argv[1], "--probe") == 0 &&
      strcmp(argv[3], "/runtime/node") != 0)) {
    fputs("Codex provider relay invocation is invalid.\n", stderr);
    return 126;
  }
  int broker_channels[BROKER_CHANNEL_COUNT];
  int broker_channel_count = strcmp(argv[1], "--probe") == 0
    ? 0 : BROKER_CHANNEL_COUNT;
  for (int index = 0; index < BROKER_CHANNEL_COUNT; index += 1) {
    broker_channels[index] = -1;
  }
  if (broker_channel_count > 0) {
    if (validate_provider_socket(argv[1], getuid()) != 0) {
      fputs("Codex provider relay endpoint attestation failed.\n", stderr);
      return 126;
    }
    for (int index = 0; index < broker_channel_count; index += 1) {
      broker_channels[index] = connect_provider_socket(argv[1]);
      if (broker_channels[index] < 0) {
        fputs("Codex provider relay channel initialization failed.\n", stderr);
        return 126;
      }
    }
    if (wait_for_broker_removal(argv[1]) != 0) {
      fputs("Codex provider relay endpoint sealing failed.\n", stderr);
      return 126;
    }
  }
  int listener = create_loopback_listener();
  if (listener < 0) {
    fputs("Codex provider relay listener initialization failed.\n", stderr);
    return 126;
  }
  if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0 ||
      prctl(PR_SET_DUMPABLE, 0, 0, 0, 0) != 0) {
    fputs("Codex provider relay hardening failed.\n", stderr);
    close(listener);
    return 126;
  }
  struct sigaction action;
  memset(&action, 0, sizeof(action));
  action.sa_handler = handle_signal;
  sigemptyset(&action.sa_mask);
  (void)sigaction(SIGINT, &action, NULL);
  (void)sigaction(SIGTERM, &action, NULL);
  (void)sigaction(SIGHUP, &action, NULL);

  sandbox_pid = fork();
  if (sandbox_pid < 0) {
    close(listener);
    return 126;
  }
  if (sandbox_pid == 0) {
    close(listener);
    for (int index = 0; index < broker_channel_count; index += 1) {
      if (broker_channels[index] >= 0) close(broker_channels[index]);
    }
    if (prctl(PR_SET_PDEATHSIG, SIGKILL) != 0 || getppid() == 1) {
      fputs("Codex cognitive child parent binding failed.\n", stderr);
      _exit(126);
    }
    const char *failed_stage = prepare_cognitive_child();
    if (failed_stage != NULL) {
      fprintf(stderr, "Codex cognitive child hardening failed at %s.\n", failed_stage);
      _exit(126);
    }
    execv(argv[3], &argv[3]);
    fputs("Codex cognitive child execution failed.\n", stderr);
    _exit(126);
  }
  int result = run_relay(listener, broker_channels, broker_channel_count);
  for (int index = 0; index < broker_channel_count; index += 1) {
    if (broker_channels[index] >= 0) close(broker_channels[index]);
  }
  close(listener);
  return result;
}
