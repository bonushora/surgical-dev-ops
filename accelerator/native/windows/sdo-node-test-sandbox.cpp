#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif

#include <windows.h>
#include <Aclapi.h>
#include <userenv.h>

#include <atomic>
#include <cwchar>
#include <filesystem>
#include <iostream>
#include <string>
#include <thread>
#include <vector>

#pragma comment(lib, "advapi32.lib")
#pragma comment(lib, "userenv.lib")

namespace fs = std::filesystem;

namespace {

constexpr DWORD kOutputLimit = 256u * 1024u;
constexpr char kEvidenceMarker[] = "SDO_WIN32_NODE_TEST_EVIDENCE ";

std::string utf8(const std::wstring& value) {
  if (value.empty()) return {};
  const int size = WideCharToMultiByte(
    CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()),
    nullptr, 0, nullptr, nullptr
  );
  if (size <= 0) return {};
  std::string result(static_cast<size_t>(size), '\0');
  if (WideCharToMultiByte(
        CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()),
        result.data(), size, nullptr, nullptr) != size) return {};
  return result;
}

void printJsonString(const std::wstring& value) {
  const std::string encoded = utf8(value);
  std::cout << '"';
  static constexpr char hex[] = "0123456789abcdef";
  for (unsigned char ch : encoded) {
    switch (ch) {
      case '\\': std::cout << "\\\\"; break;
      case '"': std::cout << "\\\""; break;
      case '\n': std::cout << "\\n"; break;
      case '\r': std::cout << "\\r"; break;
      case '\t': std::cout << "\\t"; break;
      default:
        if (ch < 0x20) {
          std::cout << "\\u00" << hex[(ch >> 4) & 0x0f] << hex[ch & 0x0f];
        } else {
          std::cout << static_cast<char>(ch);
        }
    }
  }
  std::cout << '"';
}

int fail(const wchar_t* reason) {
  std::wcerr << L"SDO_WIN32_NODE_TEST_FAILED " << reason << L"\n";
  return 2;
}

struct InternalFailure {
  const wchar_t* stage;
  DWORD win32Error;
  long internalCode;
};

int failRunNode(const InternalFailure& failure) {
  std::wcerr << L"SDO_WIN32_NODE_TEST_INTERNAL"
             << L" stage=" << failure.stage
             << L" win32Error=" << failure.win32Error
             << L" internalCode=" << failure.internalCode << L"\n";
  return -1;
}

void recordFailure(InternalFailure* failure, const wchar_t* stage,
                   DWORD win32Error, long internalCode = 0) {
  if (failure == nullptr) return;
  *failure = {stage, win32Error, internalCode};
}

bool safeText(const std::wstring& value) {
  if (value.empty()) return false;
  for (wchar_t character : value) {
    if (character < 0x20 || character == 0x7f) return false;
  }
  return true;
}

bool validFingerprint(const std::wstring& value) {
  if (value.size() != 64) return false;
  for (wchar_t character : value) {
    if (!((character >= L'0' && character <= L'9') ||
          (character >= L'a' && character <= L'f'))) return false;
  }
  return true;
}

bool safeRelativeTarget(const std::wstring& target) {
  if (!safeText(target) || target.front() == L'\\' || target.front() == L'/' ||
      target.find(L':') != std::wstring::npos) return false;
  std::wstring normalized = target;
  for (wchar_t& character : normalized) {
    if (character == L'/') character = L'\\';
  }
  size_t begin = 0;
  while (begin <= normalized.size()) {
    const size_t end = normalized.find(L'\\', begin);
    const std::wstring component = normalized.substr(
      begin, end == std::wstring::npos ? std::wstring::npos : end - begin
    );
    if (component.empty() || component == L"." || component == L"..") return false;
    if (end == std::wstring::npos) break;
    begin = end + 1;
  }
  return true;
}

std::wstring join(const std::wstring& parent, const std::wstring& child) {
  return (fs::path(parent) / fs::path(child)).wstring();
}

bool copyTree(const fs::path& source, const fs::path& destination,
              long* internalCode) {
  std::error_code error;
  if (!fs::is_directory(source, error) || error) {
    *internalCode = error ? error.value() : ERROR_DIRECTORY;
    return false;
  }
  fs::create_directories(destination, error);
  if (error) {
    *internalCode = error.value();
    return false;
  }
  for (const fs::directory_entry& entry : fs::directory_iterator(source, error)) {
    if (error || entry.is_symlink(error) || entry.is_other(error) || error) {
      *internalCode = error ? error.value() : ERROR_INVALID_DATA;
      return false;
    }
    const fs::path target = destination / entry.path().filename();
    if (entry.is_directory(error)) {
      if (error || !copyTree(entry.path(), target, internalCode)) {
        if (error) *internalCode = error.value();
        return false;
      }
    } else if (entry.is_regular_file(error)) {
      if (error || !fs::copy_file(entry.path(), target,
                                  fs::copy_options::overwrite_existing, error) || error) {
        *internalCode = error ? error.value() : ERROR_CANNOT_MAKE;
        return false;
      }
      if (!SetFileAttributesW(target.c_str(), FILE_ATTRIBUTE_READONLY)) return false;
    } else {
      *internalCode = error ? error.value() : ERROR_INVALID_DATA;
      return false;
    }
  }
  return true;
}

bool createAppContainer(const std::wstring& fingerprint, PSID* sid,
                        std::wstring* profileName) {
  *profileName = L"SdoNodeTest-" + fingerprint.substr(0, 32);
  const HRESULT result = CreateAppContainerProfile(
    profileName->c_str(), L"Surgical DevOps Node Test", L"Surgical DevOps Node Test",
    nullptr, 0, sid
  );
  return SUCCEEDED(result) && *sid != nullptr;
}

bool grantReadOnlyAppContainer(const std::wstring& root, PSID sid,
                               PSECURITY_DESCRIPTOR* oldDescriptor,
                               PACL* oldDacl, InternalFailure* failure) {
  DWORD result = GetNamedSecurityInfoW(
    const_cast<LPWSTR>(root.c_str()), SE_FILE_OBJECT, DACL_SECURITY_INFORMATION,
    nullptr, nullptr, oldDacl, nullptr, oldDescriptor
  );
  if (result != ERROR_SUCCESS) {
    recordFailure(failure, L"dacl-read", GetLastError(), result);
    return false;
  }

  EXPLICIT_ACCESSW entries[2]{};
  entries[0].grfAccessPermissions = GENERIC_READ | GENERIC_EXECUTE;
  entries[0].grfAccessMode = SET_ACCESS;
  entries[0].grfInheritance = SUB_CONTAINERS_AND_OBJECTS_INHERIT;
  entries[0].Trustee.TrusteeForm = TRUSTEE_IS_SID;
  entries[0].Trustee.ptstrName = reinterpret_cast<LPWSTR>(sid);
  entries[1] = entries[0];
  entries[1].grfAccessPermissions = GENERIC_WRITE | DELETE | FILE_DELETE_CHILD;
  entries[1].grfAccessMode = DENY_ACCESS;

  PACL updated = nullptr;
  result = SetEntriesInAclW(2, entries, *oldDacl, &updated);
  if (result != ERROR_SUCCESS) {
    recordFailure(failure, L"dacl-compose", GetLastError(), result);
    return false;
  }
  result = SetNamedSecurityInfoW(
    const_cast<LPWSTR>(root.c_str()), SE_FILE_OBJECT, DACL_SECURITY_INFORMATION,
    nullptr, nullptr, updated, nullptr
  );
  const DWORD win32Error = result == ERROR_SUCCESS ? ERROR_SUCCESS : GetLastError();
  if (updated != nullptr) LocalFree(updated);
  if (result != ERROR_SUCCESS) {
    recordFailure(failure, L"dacl-apply", win32Error, result);
  }
  return result == ERROR_SUCCESS;
}

bool restoreDacl(const std::wstring& root, PSECURITY_DESCRIPTOR descriptor, PACL dacl,
                 InternalFailure* failure = nullptr) {
  if (descriptor == nullptr) {
    recordFailure(failure, L"dacl-restore", GetLastError(), ERROR_INVALID_DATA);
    return false;
  }
  const DWORD result = SetNamedSecurityInfoW(
    const_cast<LPWSTR>(root.c_str()), SE_FILE_OBJECT, DACL_SECURITY_INFORMATION,
    nullptr, nullptr, dacl, nullptr
  );
  if (result != ERROR_SUCCESS) {
    recordFailure(failure, L"dacl-restore", GetLastError(), result);
  }
  return result == ERROR_SUCCESS;
}

struct Capture {
  std::string value;
  std::atomic<bool> overflow{false};
};

void readPipe(HANDLE pipe, Capture* capture) {
  char buffer[8192];
  DWORD count = 0;
  while (ReadFile(pipe, buffer, sizeof(buffer), &count, nullptr) && count > 0) {
    if (capture->value.size() + count > kOutputLimit) {
      capture->overflow = true;
      continue;
    }
    capture->value.append(buffer, count);
  }
}

std::wstring quote(const std::wstring& value) {
  std::wstring result = L"\"";
  size_t backslashes = 0;
  for (wchar_t character : value) {
    if (character == L'\\') {
      ++backslashes;
    } else if (character == L'"') {
      result.append(backslashes * 2 + 1, L'\\');
      result.push_back(L'"');
      backslashes = 0;
    } else {
      result.append(backslashes, L'\\');
      backslashes = 0;
      result.push_back(character);
    }
  }
  result.append(backslashes * 2, L'\\');
  result.push_back(L'"');
  return result;
}

std::vector<wchar_t> environment(const std::wstring& nodeDirectory,
                                 const std::wstring& workspace) {
  wchar_t windowsDirectory[MAX_PATH]{};
  const UINT length = GetWindowsDirectoryW(windowsDirectory, MAX_PATH);
  if (length == 0 || length >= MAX_PATH) return {};
  std::vector<std::wstring> entries{
    L"HOME=" + workspace,
    L"PATH=" + nodeDirectory,
    L"SystemRoot=" + std::wstring(windowsDirectory),
    L"TEMP=" + workspace,
    L"TMP=" + workspace
  };
  const std::wstring drive = fs::path(workspace).root_name().wstring();
  if (drive.size() == 2 && drive[1] == L':') {
    entries.insert(entries.begin(), L"=" + drive + L"=" + workspace);
  }
  std::vector<wchar_t> result;
  for (const std::wstring& entry : entries) {
    result.insert(result.end(), entry.begin(), entry.end());
    result.push_back(L'\0');
  }
  result.push_back(L'\0');
  return result;
}

int runNode(const std::wstring& operationId, const std::wstring& requirementFingerprint,
            const std::wstring& workspace, const std::wstring& target,
            const std::wstring& nodePath, DWORD timeoutMs, const std::wstring& stageRoot,
            PSID sid) {
  const std::wstring stagedWorkspace = join(stageRoot, L"workspace");
  const std::wstring stagedNodeDirectory = join(stageRoot, L"node");
  const std::wstring stagedNode = join(stagedNodeDirectory, fs::path(nodePath).filename().wstring());
  long internalCode = 0;
  if (!copyTree(fs::path(workspace), fs::path(stagedWorkspace), &internalCode)) {
    return failRunNode({L"staging-workspace", GetLastError(), internalCode});
  }
  if (!copyTree(fs::path(nodePath).parent_path(), fs::path(stagedNodeDirectory),
                &internalCode)) {
    return failRunNode({L"staging-node", GetLastError(), internalCode});
  }
  if (!fs::is_regular_file(stagedNode)) {
    return failRunNode({L"staging-node-check", GetLastError(), 0});
  }

  PSECURITY_DESCRIPTOR oldDescriptor = nullptr;
  PACL oldDacl = nullptr;
  InternalFailure failure{};
  if (!grantReadOnlyAppContainer(
      stageRoot, sid, &oldDescriptor, &oldDacl, &failure)) return failRunNode(failure);

  SECURITY_ATTRIBUTES pipeSecurity{};
  pipeSecurity.nLength = sizeof(pipeSecurity);
  pipeSecurity.bInheritHandle = TRUE;
  HANDLE stdoutRead = nullptr, stdoutWrite = nullptr;
  HANDLE stderrRead = nullptr, stderrWrite = nullptr;
  bool pipesReady = false;
  if (!CreatePipe(&stdoutRead, &stdoutWrite, &pipeSecurity, 0)) {
    recordFailure(&failure, L"stdout-pipe-create", GetLastError());
  } else if (!CreatePipe(&stderrRead, &stderrWrite, &pipeSecurity, 0)) {
    recordFailure(&failure, L"stderr-pipe-create", GetLastError());
  } else if (!SetHandleInformation(stdoutRead, HANDLE_FLAG_INHERIT, 0)) {
    recordFailure(&failure, L"stdout-pipe-inheritance", GetLastError());
  } else if (!SetHandleInformation(stderrRead, HANDLE_FLAG_INHERIT, 0)) {
    recordFailure(&failure, L"stderr-pipe-inheritance", GetLastError());
  } else {
    pipesReady = true;
  }
  if (!pipesReady) {
    restoreDacl(stageRoot, oldDescriptor, oldDacl);
    if (oldDescriptor) LocalFree(oldDescriptor);
    return failRunNode(failure);
  }

  HANDLE job = CreateJobObjectW(nullptr, nullptr);
  JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};
  limits.BasicLimitInformation.LimitFlags =
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | JOB_OBJECT_LIMIT_ACTIVE_PROCESS;
  limits.BasicLimitInformation.ActiveProcessLimit = 1;
  bool jobReady = false;
  if (job == nullptr) {
    recordFailure(&failure, L"job-create", GetLastError());
  } else if (!SetInformationJobObject(
      job, JobObjectExtendedLimitInformation, &limits, sizeof(limits))) {
    recordFailure(&failure, L"job-limit", GetLastError());
  } else {
    jobReady = true;
  }
  if (!jobReady) {
    CloseHandle(stdoutRead); CloseHandle(stdoutWrite);
    CloseHandle(stderrRead); CloseHandle(stderrWrite);
    if (job) CloseHandle(job);
    restoreDacl(stageRoot, oldDescriptor, oldDacl);
    if (oldDescriptor) LocalFree(oldDescriptor);
    return failRunNode(failure);
  }

  SECURITY_CAPABILITIES capabilities{};
  capabilities.AppContainerSid = sid;
  capabilities.CapabilityCount = 0;
  capabilities.Capabilities = nullptr;
  SIZE_T attributeSize = 0;
  InitializeProcThreadAttributeList(nullptr, 1, 0, &attributeSize);
  auto* attributes = reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(
    HeapAlloc(GetProcessHeap(), HEAP_ZERO_MEMORY, attributeSize));
  bool attributesReady = false;
  if (attributes == nullptr) {
    recordFailure(&failure, L"attribute-list-allocate", GetLastError(), ERROR_NOT_ENOUGH_MEMORY);
  } else if (InitializeProcThreadAttributeList(
      attributes, 1, 0, &attributeSize) != TRUE) {
    recordFailure(&failure, L"attribute-list-initialize", GetLastError());
  } else if (UpdateProcThreadAttribute(
      attributes, 0, PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES,
      &capabilities, sizeof(capabilities), nullptr, nullptr) != TRUE) {
    recordFailure(&failure, L"security-capabilities", GetLastError());
  } else {
    attributesReady = true;
  }
  if (!attributesReady) {
    if (attributes) HeapFree(GetProcessHeap(), 0, attributes);
    CloseHandle(job); CloseHandle(stdoutRead); CloseHandle(stdoutWrite);
    CloseHandle(stderrRead); CloseHandle(stderrWrite);
    restoreDacl(stageRoot, oldDescriptor, oldDacl);
    if (oldDescriptor) LocalFree(oldDescriptor);
    return failRunNode(failure);
  }

  const std::wstring targetPath = join(stagedWorkspace, target);
  const std::wstring allowRead = L"--allow-fs-read=" + stagedWorkspace;
  std::wstring command = quote(stagedNode) + L" --permission " + quote(allowRead) +
    L" --test-isolation=none --test " + quote(targetPath);
  std::vector<wchar_t> commandLine(command.begin(), command.end());
  commandLine.push_back(L'\0');
  std::vector<wchar_t> env = environment(stagedNodeDirectory, stagedWorkspace);
  if (env.empty()) {
    recordFailure(&failure, L"environment", GetLastError());
    DeleteProcThreadAttributeList(attributes);
    HeapFree(GetProcessHeap(), 0, attributes);
    CloseHandle(job); CloseHandle(stdoutRead); CloseHandle(stdoutWrite);
    CloseHandle(stderrRead); CloseHandle(stderrWrite);
    restoreDacl(stageRoot, oldDescriptor, oldDacl);
    if (oldDescriptor) LocalFree(oldDescriptor);
    return failRunNode(failure);
  }

  STARTUPINFOEXW startup{};
  startup.StartupInfo.cb = sizeof(startup);
  startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
  startup.StartupInfo.hStdOutput = stdoutWrite;
  startup.StartupInfo.hStdError = stderrWrite;
  startup.lpAttributeList = attributes;
  PROCESS_INFORMATION process{};
  const BOOL created = CreateProcessW(
    stagedNode.c_str(), commandLine.data(), nullptr, nullptr, TRUE,
    CREATE_SUSPENDED | CREATE_UNICODE_ENVIRONMENT | EXTENDED_STARTUPINFO_PRESENT,
    env.data(), stagedWorkspace.c_str(), &startup.StartupInfo, &process
  );
  const DWORD createError = created ? ERROR_SUCCESS : GetLastError();
  CloseHandle(stdoutWrite); CloseHandle(stderrWrite);
  DeleteProcThreadAttributeList(attributes);
  HeapFree(GetProcessHeap(), 0, attributes);
  bool processReady = false;
  if (!created) {
    recordFailure(&failure, L"process-create", createError);
  } else if (!AssignProcessToJobObject(job, process.hProcess)) {
    recordFailure(&failure, L"job-assign", GetLastError());
  } else if (ResumeThread(process.hThread) == static_cast<DWORD>(-1)) {
    recordFailure(&failure, L"process-resume", GetLastError());
  } else {
    processReady = true;
  }
  if (!processReady) {
    if (created) TerminateProcess(process.hProcess, ERROR_ACCESS_DENIED);
    if (created) { CloseHandle(process.hThread); CloseHandle(process.hProcess); }
    CloseHandle(job); CloseHandle(stdoutRead); CloseHandle(stderrRead);
    restoreDacl(stageRoot, oldDescriptor, oldDacl);
    if (oldDescriptor) LocalFree(oldDescriptor);
    return failRunNode(failure);
  }

  Capture stdoutCapture, stderrCapture;
  std::thread stdoutReader(readPipe, stdoutRead, &stdoutCapture);
  std::thread stderrReader(readPipe, stderrRead, &stderrCapture);
  DWORD wait = WaitForSingleObject(process.hProcess, timeoutMs);
  if (wait == WAIT_TIMEOUT) TerminateJobObject(job, WAIT_TIMEOUT);
  if (wait == WAIT_TIMEOUT) WaitForSingleObject(process.hProcess, INFINITE);
  DWORD exitCode = WAIT_TIMEOUT;
  if (wait != WAIT_TIMEOUT && !GetExitCodeProcess(process.hProcess, &exitCode)) {
    exitCode = ERROR_PROCESS_ABORTED;
  }
  CloseHandle(process.hThread);
  CloseHandle(process.hProcess);
  CloseHandle(stdoutRead); CloseHandle(stderrRead);
  stdoutReader.join(); stderrReader.join();
  CloseHandle(job);

  const bool restored = restoreDacl(stageRoot, oldDescriptor, oldDacl, &failure);
  if (oldDescriptor) LocalFree(oldDescriptor);
  if (!restored) return failRunNode(failure);
  if (stdoutCapture.overflow) {
    return failRunNode({L"stdout-overflow", GetLastError(), kOutputLimit});
  }
  if (stderrCapture.overflow) {
    return failRunNode({L"stderr-overflow", GetLastError(), kOutputLimit});
  }
  std::cout << stdoutCapture.value;
  std::cerr << stderrCapture.value;
  std::cout << '\n' << kEvidenceMarker;
  std::cout << "{\"schema\":\"sdo.windows_node_test_sandbox_result.v1\","
               "\"decision\":\"ENFORCED\",\"operationId\":";
  printJsonString(operationId);
  std::cout << ",\"requirementFingerprint\":";
  printJsonString(requirementFingerprint);
  std::cout << ",\"workspace\":";
  printJsonString(workspace);
  std::cout << ",\"target\":";
  printJsonString(target);
  std::cout << ",\"stagingWorkspace\":";
  printJsonString(stagedWorkspace);
  std::cout << ",\"stagedNode\":";
  printJsonString(stagedNode);
  std::cout << ",\"stagedTarget\":";
  printJsonString(join(stagedWorkspace, target));
  std::cout << ",\"appContainerNoNetworkCapabilities\":true,"
               "\"workspaceReadOnly\":true,\"workspaceBound\":true,"
               "\"networkDenied\":true,\"genericProcessDenied\":true,"
               "\"secretAccessDenied\":true,\"jobTreeKillEnabled\":true}\n";
  return exitCode == WAIT_TIMEOUT ? 124 : static_cast<int>(exitCode);
}

}  // namespace

int wmain(int argc, wchar_t* argv[]) {
  if (argc != 7 || argv[1] == nullptr || !safeText(argv[1]) ||
      std::wcslen(argv[1]) > 128 ||
      !validFingerprint(argv[2]) || !safeText(argv[3]) || !safeRelativeTarget(argv[4]) ||
      !safeText(argv[5])) return fail(L"invalid arguments");
  wchar_t* end = nullptr;
  const unsigned long timeout = wcstoul(argv[6], &end, 10);
  if (end == argv[6] || *end != L'\0' || timeout == 0 || timeout > 300000) {
    return fail(L"invalid timeout");
  }

  PSID sid = nullptr;
  std::wstring profileName;
  if (!createAppContainer(argv[2], &sid, &profileName)) {
    return fail(L"AppContainer unavailable");
  }
  std::error_code error;
  const fs::path stage = fs::temp_directory_path(error) /
    (L"sdo-node-test-" + profileName);
  if (error || !fs::create_directories(stage, error) || error) {
    DeleteAppContainerProfile(profileName.c_str());
    FreeSid(sid);
    return fail(L"staging unavailable");
  }
  const int result = runNode(
    argv[1], argv[2], argv[3], [&]() {
      std::wstring target = argv[4];
      for (wchar_t& character : target) if (character == L'/') character = L'\\';
      return target;
    }(), argv[5], static_cast<DWORD>(timeout), stage.wstring(), sid
  );
  fs::remove_all(stage, error);
  const bool stageRemoved = !error;
  const int stageCleanupCode = error.value();
  const HRESULT profileCleanupResult = DeleteAppContainerProfile(profileName.c_str());
  const bool profileDeleted = profileCleanupResult == S_OK;
  FreeSid(sid);
  if (result < 0 || !stageRemoved || !profileDeleted) {
    std::wcerr << L"SDO_WIN32_NODE_TEST_FAILED"
               << L" runNode=" << (result >= 0 ? L"PASS" : L"FAIL")
               << L" runNodeCode=" << result
               << L" stagingCleanup=" << (stageRemoved ? L"PASS" : L"FAIL")
               << L" stagingCleanupCode=" << stageCleanupCode
               << L" profileCleanup=" << (profileDeleted ? L"PASS" : L"FAIL")
               << L" profileCleanupHresult=" << static_cast<long>(profileCleanupResult)
               << L"\n";
    return 2;
  }
  return result;
}
