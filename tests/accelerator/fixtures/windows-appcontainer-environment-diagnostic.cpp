#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif

#include <windows.h>
#include <Aclapi.h>
#include <sddl.h>
#include <userenv.h>

#include <algorithm>
#include <atomic>
#include <cctype>
#include <cwchar>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>
#include <thread>
#include <utility>
#include <vector>

#pragma comment(lib, "advapi32.lib")
#pragma comment(lib, "userenv.lib")

namespace fs = std::filesystem;

namespace {

constexpr DWORD kChildExit = 37;
constexpr DWORD kWaitMilliseconds = 30000;
constexpr DWORD kNodeOutputLimit = 256u * 1024u;
constexpr wchar_t kChildArgument[] = L"--inert-child";
constexpr wchar_t kNodeDiagnosticArgument[] = L"--node-startup-diagnostic";

struct Entry {
  std::wstring name;
  std::wstring value;
};

struct Environment {
  std::vector<Entry> entries;
  std::vector<wchar_t> block;
};

struct EnvironmentMetadata {
  std::vector<std::string> names;
  size_t entryCount;
  size_t wcharCount;
  bool sorted;
  bool doubleNull;
};

struct VariantResult {
  bool createProcess;
  DWORD win32Error;
  const char* stage;
  bool hasChildExit;
  DWORD childExit;
};

struct ProfileEnvironmentMetadata {
  bool hasLocalAppData;
  bool tempProfileBound;
  bool tmpProfileBound;
  bool profileDirectoryExists;
  bool profileTempExists;
};

enum class AclAssessment {
  kAllowed,
  kDenied,
  kIndeterminate
};

struct PathMetadata {
  bool exists;
  const char* pathKind;
  const char* basename;
  const char* executableType;
  AclAssessment aclAssessment;
  DWORD aclDiagnosticCode;
};

struct DiagnosticFailure {
  const char* stage;
  DWORD win32Error;
};

const char* aclAssessmentName(AclAssessment assessment) {
  switch (assessment) {
    case AclAssessment::kAllowed: return "ALLOWED";
    case AclAssessment::kDenied: return "DENIED";
    case AclAssessment::kIndeterminate: return "INDETERMINATE";
  }
  return "INDETERMINATE";
}

DWORD win32CodeFromHresult(HRESULT value) {
  return static_cast<DWORD>(HRESULT_CODE(value));
}

int fail(const DiagnosticFailure& failure) {
  std::cerr << "WINDOWS_ENVIRONMENT_DIAGNOSTIC_FAILED"
            << " stage=" << failure.stage
            << " win32Error=" << failure.win32Error << '\n';
  return 2;
}

bool equalName(const std::wstring& left, const std::wstring& right) {
  return CompareStringOrdinal(
    left.c_str(), static_cast<int>(left.size()),
    right.c_str(), static_cast<int>(right.size()), TRUE
  ) == CSTR_EQUAL;
}

bool lessName(const Entry& left, const Entry& right) {
  return CompareStringOrdinal(
    left.name.c_str(), static_cast<int>(left.name.size()),
    right.name.c_str(), static_cast<int>(right.name.size()), TRUE
  ) == CSTR_LESS_THAN;
}

void setEntry(std::vector<Entry>* entries, const std::wstring& name,
              const std::wstring& value) {
  for (Entry& entry : *entries) {
    if (equalName(entry.name, name)) {
      entry.value = value;
      return;
    }
  }
  entries->push_back({name, value});
}

bool nativeValue(const void* environment, const std::wstring& requested,
                 std::wstring* value) {
  if (environment == nullptr || value == nullptr) return false;
  const auto* cursor = static_cast<const wchar_t*>(environment);
  while (*cursor != L'\0') {
    const std::wstring entry(cursor);
    const size_t separator = entry.find(L'=', entry.front() == L'=' ? 1u : 0u);
    if (separator != std::wstring::npos && separator > 0) {
      const std::wstring name = entry.substr(0, separator);
      if (equalName(name, requested)) {
        *value = entry.substr(separator + 1);
        return !value->empty();
      }
    }
    cursor += entry.size() + 1;
  }
  return false;
}

bool addDriveEntry(std::vector<Entry>* entries, const std::wstring& confinedRoot) {
  const std::wstring drive = fs::path(confinedRoot).root_name().wstring();
  if (drive.size() != 2 || drive[1] != L':') return false;
  setEntry(entries, L"=" + drive, confinedRoot);
  return true;
}

Environment serialize(std::vector<Entry> entries) {
  std::sort(entries.begin(), entries.end(), lessName);
  std::vector<wchar_t> block;
  for (const Entry& entry : entries) {
    const std::wstring serialized = entry.name + L"=" + entry.value;
    block.insert(block.end(), serialized.begin(), serialized.end());
    block.push_back(L'\0');
  }
  block.push_back(L'\0');
  return {std::move(entries), std::move(block)};
}

Environment profileEnvironment(const Environment& base, const std::wstring& profile,
                               bool bindTemp) {
  std::vector<Entry> entries = base.entries;
  setEntry(&entries, L"LOCALAPPDATA", profile);
  if (bindTemp) {
    const std::wstring temp = (fs::path(profile) / L"Temp").wstring();
    setEntry(&entries, L"TEMP", temp);
    setEntry(&entries, L"TMP", temp);
  }
  return serialize(std::move(entries));
}

Environment environmentVariant(const Environment& base, const wchar_t* variable,
                               const std::wstring& value) {
  std::vector<Entry> entries = base.entries;
  setEntry(&entries, variable, value);
  return serialize(std::move(entries));
}

bool environmentSorted(const Environment& environment) {
  return std::is_sorted(
    environment.entries.begin(), environment.entries.end(), lessName
  );
}

bool environmentDoubleNull(const Environment& environment) {
  return environment.block.size() >= 2 &&
    environment.block[environment.block.size() - 1] == L'\0' &&
    environment.block[environment.block.size() - 2] == L'\0';
}

bool environmentWellFormed(const Environment& environment) {
  if (!environmentDoubleNull(environment) || environment.entries.empty()) return false;
  for (size_t index = 0; index < environment.entries.size(); ++index) {
    const Entry& entry = environment.entries[index];
    if (entry.name.empty() || entry.value.empty()) return false;
    if (entry.name.front() != L'=' && entry.name.find(L'=') != std::wstring::npos) {
      return false;
    }
    if (index > 0 && equalName(environment.entries[index - 1].name, entry.name)) {
      return false;
    }
  }
  return environmentSorted(environment);
}

bool manualCurrentEnvironment(const std::wstring& confinedWorkspace,
                              const std::wstring& fixedPath,
                              Environment* environment,
                              DiagnosticFailure* failure) {
  wchar_t windowsDirectory[MAX_PATH]{};
  const UINT length = GetWindowsDirectoryW(windowsDirectory, MAX_PATH);
  if (length == 0 || length >= MAX_PATH) {
    *failure = {
      "manual-system-root", length == 0 ? GetLastError() : ERROR_INSUFFICIENT_BUFFER
    };
    return false;
  }
  std::vector<Entry> entries{
    {L"HOME", confinedWorkspace},
    {L"PATH", fixedPath},
    {L"SystemRoot", std::wstring(windowsDirectory)},
    {L"TEMP", confinedWorkspace},
    {L"TMP", confinedWorkspace}
  };
  if (!addDriveEntry(&entries, confinedWorkspace)) {
    *failure = {"manual-drive-entry", ERROR_INVALID_DRIVE};
    return false;
  }
  *environment = serialize(std::move(entries));
  return environmentWellFormed(*environment);
}

bool nativeSanitizedEnvironment(HANDLE token,
                                const std::wstring& confinedWorkspace,
                                const std::wstring& fixedPath,
                                bool includeOptionalSystemEntries,
                                Environment* environment,
                                DiagnosticFailure* failure) {
  void* nativeEnvironment = nullptr;
  const BOOL created = CreateEnvironmentBlock(&nativeEnvironment, token, FALSE);
  const DWORD createError = created ? ERROR_SUCCESS : GetLastError();
  if (!created || nativeEnvironment == nullptr) {
    *failure = {token == nullptr ? "minimal-native-create" : "native-create", createError};
    return false;
  }

  std::vector<Entry> entries;
  std::wstring systemRoot;
  if (!nativeValue(nativeEnvironment, L"SystemRoot", &systemRoot)) {
    const BOOL destroyed = DestroyEnvironmentBlock(nativeEnvironment);
    const DWORD destroyError = destroyed ? ERROR_SUCCESS : GetLastError();
    *failure = {
      token == nullptr ? "minimal-native-system-root" : "native-system-root",
      destroyed ? ERROR_ENVVAR_NOT_FOUND : destroyError
    };
    return false;
  }
  setEntry(&entries, L"SystemRoot", systemRoot);

  if (includeOptionalSystemEntries) {
    std::wstring value;
    if (nativeValue(nativeEnvironment, L"windir", &value)) {
      setEntry(&entries, L"windir", value);
    }
    value.clear();
    if (nativeValue(nativeEnvironment, L"ComSpec", &value)) {
      setEntry(&entries, L"ComSpec", value);
    }
  }

  const BOOL destroyed = DestroyEnvironmentBlock(nativeEnvironment);
  const DWORD destroyError = destroyed ? ERROR_SUCCESS : GetLastError();
  if (!destroyed) {
    *failure = {
      token == nullptr ? "minimal-native-destroy" : "native-destroy", destroyError
    };
    return false;
  }

  setEntry(&entries, L"HOME", confinedWorkspace);
  setEntry(&entries, L"PATH", fixedPath);
  setEntry(&entries, L"TEMP", confinedWorkspace);
  setEntry(&entries, L"TMP", confinedWorkspace);
  if (!addDriveEntry(&entries, confinedWorkspace)) {
    *failure = {
      token == nullptr ? "minimal-native-drive-entry" : "native-drive-entry",
      ERROR_INVALID_DRIVE
    };
    return false;
  }
  *environment = serialize(std::move(entries));
  return environmentWellFormed(*environment);
}

bool grantAppContainerReadExecute(const std::wstring& root, PSID sid,
                                  PSECURITY_DESCRIPTOR* oldDescriptor,
                                  PACL* oldDacl, DiagnosticFailure* failure) {
  DWORD result = GetNamedSecurityInfoW(
    const_cast<LPWSTR>(root.c_str()), SE_FILE_OBJECT, DACL_SECURITY_INFORMATION,
    nullptr, nullptr, oldDacl, nullptr, oldDescriptor
  );
  if (result != ERROR_SUCCESS) {
    *failure = {"dacl-read", result};
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
    *failure = {"dacl-compose", result};
    return false;
  }
  result = SetNamedSecurityInfoW(
    const_cast<LPWSTR>(root.c_str()), SE_FILE_OBJECT, DACL_SECURITY_INFORMATION,
    nullptr, nullptr, updated, nullptr
  );
  if (updated != nullptr) LocalFree(updated);
  if (result != ERROR_SUCCESS) {
    *failure = {"dacl-apply", result};
    return false;
  }
  return true;
}

bool restoreDacl(const std::wstring& root, PSECURITY_DESCRIPTOR descriptor,
                 PACL dacl, DiagnosticFailure* failure) {
  if (descriptor == nullptr) {
    *failure = {"dacl-restore", ERROR_INVALID_DATA};
    return false;
  }
  const DWORD result = SetNamedSecurityInfoW(
    const_cast<LPWSTR>(root.c_str()), SE_FILE_OBJECT, DACL_SECURITY_INFORMATION,
    nullptr, nullptr, dacl, nullptr
  );
  if (result != ERROR_SUCCESS) {
    *failure = {"dacl-restore", result};
    return false;
  }
  return true;
}

bool validateAppContainerPath(const std::wstring& path, bool expectDirectory,
                              const char* basename, PSID sid,
                              PathMetadata* metadata,
                              DiagnosticFailure* failure) {
  const DWORD attributes = GetFileAttributesW(path.c_str());
  const DWORD attributeError =
    attributes == INVALID_FILE_ATTRIBUTES ? GetLastError() : ERROR_SUCCESS;
  const bool exists = attributes != INVALID_FILE_ATTRIBUTES;
  const bool isDirectory = exists && (attributes & FILE_ATTRIBUTE_DIRECTORY) != 0;
  *metadata = {
    exists, expectDirectory ? "directory" : "file", basename,
    expectDirectory ? "directory" : "regular-file",
    AclAssessment::kIndeterminate,
    exists ? ERROR_SUCCESS : attributeError
  };
  if (!exists || isDirectory != expectDirectory) {
    *failure = {
      expectDirectory ? "current-directory-validate" : "executable-validate",
      exists ? ERROR_DIRECTORY : attributeError
    };
    return false;
  }
  if (!expectDirectory && (attributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0) {
    *failure = {"executable-validate", ERROR_REPARSE_TAG_INVALID};
    return false;
  }

  PSECURITY_DESCRIPTOR descriptor = nullptr;
  PACL dacl = nullptr;
  const DWORD securityError = GetNamedSecurityInfoW(
    const_cast<LPWSTR>(path.c_str()), SE_FILE_OBJECT, DACL_SECURITY_INFORMATION,
    nullptr, nullptr, &dacl, nullptr, &descriptor
  );
  if (securityError != ERROR_SUCCESS || dacl == nullptr) {
    if (descriptor != nullptr) LocalFree(descriptor);
    metadata->aclAssessment = AclAssessment::kIndeterminate;
    metadata->aclDiagnosticCode =
      securityError == ERROR_SUCCESS ? ERROR_INVALID_ACL : securityError;
    return true;
  }

  TRUSTEEW trustee{};
  BuildTrusteeWithSidW(&trustee, sid);
  ACCESS_MASK rights = 0;
  const DWORD rightsError = GetEffectiveRightsFromAclW(dacl, &trustee, &rights);
  LocalFree(descriptor);
  if (rightsError != ERROR_SUCCESS) {
    metadata->aclAssessment = AclAssessment::kIndeterminate;
    metadata->aclDiagnosticCode = rightsError;
    return true;
  }
  GENERIC_MAPPING fileMapping{
    FILE_GENERIC_READ, FILE_GENERIC_WRITE, FILE_GENERIC_EXECUTE, FILE_ALL_ACCESS
  };
  MapGenericMask(&rights, &fileMapping);
  const ACCESS_MASK required = FILE_GENERIC_READ | FILE_GENERIC_EXECUTE;
  metadata->aclAssessment = (rights & required) == required
    ? AclAssessment::kAllowed : AclAssessment::kIndeterminate;
  metadata->aclDiagnosticCode = metadata->aclAssessment == AclAssessment::kAllowed
    ? ERROR_SUCCESS : ERROR_ACCESS_DENIED;
  return true;
}

std::wstring quote(const std::wstring& value) {
  return L"\"" + value + L"\"";
}

VariantResult runVariant(const std::wstring& executable,
                         const wchar_t* currentDirectory,
                         const Environment& environment,
                         LPPROC_THREAD_ATTRIBUTE_LIST attributes,
                         HANDLE job, bool explicitApplicationName = true) {
  std::wstring command = quote(executable) + L" " + kChildArgument;
  std::vector<wchar_t> commandLine(command.begin(), command.end());
  commandLine.push_back(L'\0');

  STARTUPINFOEXW startup{};
  startup.StartupInfo.cb = sizeof(startup);
  startup.lpAttributeList = attributes;
  PROCESS_INFORMATION process{};
  const BOOL created = CreateProcessW(
    explicitApplicationName ? executable.c_str() : nullptr,
    commandLine.data(), nullptr, nullptr, FALSE,
    CREATE_SUSPENDED | CREATE_UNICODE_ENVIRONMENT | EXTENDED_STARTUPINFO_PRESENT,
    const_cast<wchar_t*>(environment.block.data()), currentDirectory,
    &startup.StartupInfo, &process
  );
  const DWORD createError = created ? ERROR_SUCCESS : GetLastError();
  if (!created) {
    return {false, createError, "process-create", false, 0};
  }

  if (!AssignProcessToJobObject(job, process.hProcess)) {
    const DWORD error = GetLastError();
    TerminateProcess(process.hProcess, ERROR_ACCESS_DENIED);
    WaitForSingleObject(process.hProcess, INFINITE);
    CloseHandle(process.hThread);
    CloseHandle(process.hProcess);
    return {true, error, "job-assign", false, 0};
  }
  if (ResumeThread(process.hThread) == static_cast<DWORD>(-1)) {
    const DWORD error = GetLastError();
    TerminateJobObject(job, ERROR_ACCESS_DENIED);
    WaitForSingleObject(process.hProcess, INFINITE);
    CloseHandle(process.hThread);
    CloseHandle(process.hProcess);
    return {true, error, "process-resume", false, 0};
  }

  const DWORD wait = WaitForSingleObject(process.hProcess, kWaitMilliseconds);
  if (wait != WAIT_OBJECT_0) {
    const DWORD error = wait == WAIT_FAILED ? GetLastError() : WAIT_TIMEOUT;
    TerminateJobObject(job, error);
    WaitForSingleObject(process.hProcess, INFINITE);
    CloseHandle(process.hThread);
    CloseHandle(process.hProcess);
    return {true, error, wait == WAIT_TIMEOUT ? "process-timeout" : "process-wait", false, 0};
  }

  DWORD childExit = 0;
  if (!GetExitCodeProcess(process.hProcess, &childExit)) {
    const DWORD error = GetLastError();
    CloseHandle(process.hThread);
    CloseHandle(process.hProcess);
    return {true, error, "process-exit", false, 0};
  }
  CloseHandle(process.hThread);
  CloseHandle(process.hProcess);
  return {true, ERROR_SUCCESS, "complete", true, childExit};
}

std::string safeName(const std::wstring& name) {
  std::string result;
  for (const wchar_t character : name) {
    if (!((character >= L'A' && character <= L'Z') ||
          (character >= L'a' && character <= L'z') ||
          (character >= L'0' && character <= L'9') ||
          character == L'_' || character == L'=' || character == L':')) {
      return "INVALID_NAME";
    }
    result.push_back(static_cast<char>(character));
  }
  return result;
}

EnvironmentMetadata metadata(const Environment& environment) {
  std::vector<std::string> names;
  for (const Entry& entry : environment.entries) names.push_back(safeName(entry.name));
  return {
    std::move(names), environment.entries.size(), environment.block.size(),
    environmentSorted(environment), environmentDoubleNull(environment)
  };
}

void reportVariant(const char* variant, const char* source,
                   const EnvironmentMetadata& environment,
                   const VariantResult& result) {
  std::cout << "variant=" << variant
            << " environmentSource=" << source
            << " entryNames=[";
  for (size_t index = 0; index < environment.names.size(); ++index) {
    if (index != 0) std::cout << ',';
    std::cout << environment.names[index];
  }
  std::cout << "] entryCount=" << environment.entryCount
            << " wcharCount=" << environment.wcharCount
            << " sorted=" << (environment.sorted ? "true" : "false")
            << " doubleNull=" << (environment.doubleNull ? "true" : "false")
            << " createProcess=" << (result.createProcess ? "PASS" : "FAIL")
            << " win32Error=" << result.win32Error
            << " stage=" << result.stage
            << " childExit=";
  if (result.hasChildExit) std::cout << result.childExit;
  else std::cout << "null";
  std::cout << '\n';
}

void reportProfileVariant(const char* variant, const Environment& environment,
                          const ProfileEnvironmentMetadata& profile,
                          const VariantResult& result, bool cleanup) {
  const EnvironmentMetadata meta = metadata(environment);
  std::cout << "variant=" << variant << " environmentSource=profile-"
            << (profile.tempProfileBound ? "complete" :
                (profile.hasLocalAppData ? "localappdata" : "native-sanitized"))
            << " entryNames=[";
  for (size_t index = 0; index < meta.names.size(); ++index) {
    if (index != 0) std::cout << ',';
    std::cout << meta.names[index];
  }
  std::cout << "] hasLocalAppData=" << (profile.hasLocalAppData ? "true" : "false")
            << " tempProfileBound=" << (profile.tempProfileBound ? "true" : "false")
            << " tmpProfileBound=" << (profile.tmpProfileBound ? "true" : "false")
            << " profileDirectoryExists="
            << (profile.profileDirectoryExists ? "true" : "false")
            << " profileTempExists=" << (profile.profileTempExists ? "true" : "false")
            << " createProcess=" << (result.createProcess ? "PASS" : "FAIL")
            << " win32Error=" << result.win32Error << " stage=" << result.stage
            << " childExit=";
  if (result.hasChildExit) std::cout << result.childExit;
  else std::cout << "null";
  std::cout << " cleanup=" << (cleanup ? "PASS" : "FAIL") << '\n';
}

void reportArgumentVariant(const char* variant, const char* currentDirectoryMode,
                           const PathMetadata& executable,
                           const PathMetadata& currentDirectory,
                           const VariantResult& result, bool cleanup,
                           bool explicitApplicationName = true) {
  std::cout << "variant=" << variant
            << " applicationNameMode="
            << (explicitApplicationName ? "absolute" : "null")
            << " executablePathKind=" << executable.pathKind
            << " executableExists=" << (executable.exists ? "true" : "false")
            << " executableType=" << executable.executableType
            << " aclAssessment=" << aclAssessmentName(executable.aclAssessment)
            << " aclDiagnosticCode=" << executable.aclDiagnosticCode
            << " executableBasename=" << executable.basename
            << " commandLineMode="
            << (explicitApplicationName ? "explicit-separated" : "quoted-first-token")
            << " argcExpected=2"
            << " currentDirectoryMode=" << currentDirectoryMode
            << " currentDirectoryPathKind=" << currentDirectory.pathKind
            << " currentDirectoryExists="
            << (currentDirectory.exists ? "true" : "false")
            << " currentDirectoryAclAssessment="
            << aclAssessmentName(currentDirectory.aclAssessment)
            << " currentDirectoryBasename=" << currentDirectory.basename
            << " environmentSource=native-sanitized"
            << " appContainer=true"
            << " creationFlags=CREATE_SUSPENDED|CREATE_UNICODE_ENVIRONMENT|"
               "EXTENDED_STARTUPINFO_PRESENT"
            << " startupInfoExBytes=" << sizeof(STARTUPINFOEXW)
            << " securityCapabilities=true"
            << " attributeListValid=true"
            << " creationToken=calling-process"
            << " createProcess=" << (result.createProcess ? "PASS" : "FAIL")
            << " win32Error=" << result.win32Error
            << " stage=" << result.stage
            << " childExit=";
  if (result.hasChildExit) std::cout << result.childExit;
  else std::cout << "null";
  std::cout << " cleanup=" << (cleanup ? "PASS" : "FAIL") << '\n';
}

struct NodeCapture {
  std::string value;
  std::atomic<bool> overflow{false};
};

struct NodeStepResult {
  const char* step;
  bool processCreated;
  bool hasExitCode;
  DWORD exitCode;
  const char* stage;
  const char* stderrClass;
  std::string fatalReason;
  const char* subsystem;
  std::string firstNativeFrame;
  bool expected;
  bool nativeEventObserved = false;
  bool initialBreakpointObserved = false;
  bool hasExceptionCode = false;
  DWORD exceptionCode = 0;
  bool hasFirstChance = false;
  bool firstChance = false;
  bool hasExitProcessCode = false;
  DWORD exitProcessCode = 0;
  const char* exceptionClass = "NONE";
  const char* terminationClass = "UNKNOWN";
  const char* terminationOrigin = "INDETERMINATE";
  const char* debugLoopStatus = "NOT_OBSERVED";
  std::string nativeFrames = "none";
};

void readNodePipe(HANDLE pipe, NodeCapture* capture) {
  char buffer[8192];
  DWORD count = 0;
  while (ReadFile(pipe, buffer, sizeof(buffer), &count, nullptr) && count > 0) {
    if (capture->value.size() + count > kNodeOutputLimit) {
      capture->overflow = true;
      continue;
    }
    capture->value.append(buffer, count);
  }
}

bool copyNodeTree(const fs::path& source, const fs::path& destination,
                  DiagnosticFailure* failure) {
  std::error_code error;
  if (!fs::is_directory(source, error) || error) {
    *failure = {"node-source", error ? static_cast<DWORD>(error.value()) : ERROR_DIRECTORY};
    return false;
  }
  fs::create_directories(destination, error);
  if (error) {
    *failure = {"node-stage-create", static_cast<DWORD>(error.value())};
    return false;
  }
  for (const fs::directory_entry& entry : fs::directory_iterator(source, error)) {
    if (error || entry.is_symlink(error) || entry.is_other(error) || error) {
      *failure = {"node-stage-shape",
        error ? static_cast<DWORD>(error.value()) : ERROR_INVALID_DATA};
      return false;
    }
    const fs::path target = destination / entry.path().filename();
    if (entry.is_directory(error)) {
      if (error || !copyNodeTree(entry.path(), target, failure)) return false;
    } else if (entry.is_regular_file(error)) {
      if (error || !fs::copy_file(entry.path(), target,
          fs::copy_options::overwrite_existing, error) || error) {
        *failure = {"node-stage-copy",
          error ? static_cast<DWORD>(error.value()) : ERROR_CANNOT_MAKE};
        return false;
      }
      if (!SetFileAttributesW(target.c_str(), FILE_ATTRIBUTE_READONLY)) {
        *failure = {"node-stage-readonly", GetLastError()};
        return false;
      }
    } else {
      *failure = {"node-stage-shape", ERROR_INVALID_DATA};
      return false;
    }
  }
  return true;
}

bool writeNodeFixture(const fs::path& target, const char* source,
                      DiagnosticFailure* failure) {
  std::ofstream output(target, std::ios::binary | std::ios::trunc);
  output << source;
  output.close();
  if (!output) {
    *failure = {"node-fixture-write", ERROR_WRITE_FAULT};
    return false;
  }
  if (!SetFileAttributesW(target.c_str(), FILE_ATTRIBUTE_READONLY)) {
    *failure = {"node-fixture-readonly", GetLastError()};
    return false;
  }
  return true;
}

bool productionNodeEnvironment(const std::wstring& nodeDirectory,
                               const std::wstring& workspace,
                               const std::wstring& profile,
                               Environment* environment,
                               DiagnosticFailure* failure) {
  wchar_t windowsDirectory[MAX_PATH]{};
  const UINT length = GetWindowsDirectoryW(windowsDirectory, MAX_PATH);
  if (length == 0 || length >= MAX_PATH) {
    *failure = {"node-environment-system-root",
      length == 0 ? GetLastError() : ERROR_INSUFFICIENT_BUFFER};
    return false;
  }
  std::vector<Entry> entries{
    {L"HOME", workspace},
    {L"LOCALAPPDATA", profile},
    {L"PATH", nodeDirectory},
    {L"SystemRoot", std::wstring(windowsDirectory)},
    {L"TEMP", workspace},
    {L"TMP", workspace}
  };
  if (!addDriveEntry(&entries, workspace)) {
    *failure = {"node-environment-drive-entry", ERROR_INVALID_DRIVE};
    return false;
  }
  *environment = serialize(std::move(entries));
  if (!environmentWellFormed(*environment)) {
    *failure = {"node-environment-shape", ERROR_BAD_ENVIRONMENT};
    return false;
  }
  return true;
}

std::string firstNodeNativeFrame(const std::string& stderrText) {
  size_t first = std::string::npos;
  for (const char* prefix : {"node::", "v8::", "uv_"}) {
    const size_t candidate = stderrText.find(prefix);
    if (candidate != std::string::npos && (first == std::string::npos || candidate < first)) {
      first = candidate;
    }
  }
  if (first == std::string::npos) return "none";
  size_t end = first;
  while (end < stderrText.size()) {
    const unsigned char character = static_cast<unsigned char>(stderrText[end]);
    if (!(std::isalnum(character) || character == ':' || character == '_' ||
          character == '+' || character == '-' || character == '<' ||
          character == '>' || character == '~' || character == '.')) break;
    ++end;
  }
  const std::string frame = stderrText.substr(first, end - first);
  return frame.empty() || frame.size() > 160 ? "indeterminate" : frame;
}

std::string nodeNativeFrames(const std::string& stderrText) {
  std::string result;
  size_t cursor = 0;
  size_t count = 0;
  while (cursor < stderrText.size() && count < 12) {
    size_t first = std::string::npos;
    for (const char* prefix : {"node::", "v8::", "uv_"}) {
      const size_t candidate = stderrText.find(prefix, cursor);
      if (candidate != std::string::npos &&
          (first == std::string::npos || candidate < first)) {
        first = candidate;
      }
    }
    if (first == std::string::npos) break;
    size_t end = first;
    while (end < stderrText.size()) {
      const unsigned char character = static_cast<unsigned char>(stderrText[end]);
      if (!(std::isalnum(character) || character == ':' || character == '_' ||
            character == '+' || character == '-' || character == '<' ||
            character == '>' || character == '~' || character == '.')) break;
      ++end;
    }
    const std::string frame = stderrText.substr(first, end - first);
    if (!frame.empty() && frame.size() <= 160) {
      if (!result.empty()) result.push_back(',');
      result += frame;
      ++count;
    }
    cursor = end > first ? end : first + 1;
  }
  return result.empty() ? "none" : result;
}

std::string sanitizedFatalReason(const std::string& stderrText) {
  const std::vector<std::string> markers{
    "Fatal error in", "FATAL ERROR", "Check failed:", "Assertion failed"
  };
  size_t markerPosition = std::string::npos;
  for (const std::string& marker : markers) {
    const size_t candidate = stderrText.find(marker);
    if (candidate != std::string::npos &&
        (markerPosition == std::string::npos || candidate < markerPosition)) {
      markerPosition = candidate;
    }
  }
  if (markerPosition == std::string::npos) return "NATIVE_ABORT_NO_MESSAGE";
  size_t end = stderrText.find('\n', markerPosition);
  if (end == std::string::npos) end = stderrText.size();
  const std::string line = stderrText.substr(markerPosition, end - markerPosition);
  std::string result;
  bool previousSeparator = false;
  for (size_t index = 0; index < line.size() && result.size() < 120; ++index) {
    if (index + 2 < line.size() &&
        ((line[index] >= 'A' && line[index] <= 'Z') ||
         (line[index] >= 'a' && line[index] <= 'z')) &&
        line[index + 1] == ':' &&
        (line[index + 2] == '\\' || line[index + 2] == '/')) {
      result += "PATH";
      previousSeparator = false;
      while (index < line.size() && line[index] != ' ' && line[index] != '\t') ++index;
      if (index < line.size()) --index;
      continue;
    }
    const unsigned char character = static_cast<unsigned char>(line[index]);
    if (std::isalnum(character)) {
      result.push_back(static_cast<char>(character));
      previousSeparator = false;
    } else if (!previousSeparator) {
      result.push_back('_');
      previousSeparator = true;
    }
  }
  while (!result.empty() && result.back() == '_') result.pop_back();
  return result.empty() ? "NATIVE_ABORT_MESSAGE_EMPTY" : result;
}

const char* fatalSubsystem(const std::string& stderrText) {
  std::string lower = stderrText;
  std::transform(lower.begin(), lower.end(), lower.begin(),
    [](unsigned char character) { return static_cast<char>(std::tolower(character)); });
  if (lower.find("icu") != std::string::npos) return "ICU";
  if (lower.find("config") != std::string::npos ||
      lower.find("node_options") != std::string::npos) return "CONFIGURATION";
  if (lower.find("permission") != std::string::npos) return "PERMISSION";
  if (lower.find("environment") != std::string::npos) return "ENVIRONMENT";
  return "NODE_BOOTSTRAP";
}

const char* exceptionClassName(DWORD code) {
  switch (code) {
    case EXCEPTION_BREAKPOINT: return "BREAKPOINT";
    case EXCEPTION_SINGLE_STEP: return "SINGLE_STEP";
    case EXCEPTION_ACCESS_VIOLATION: return "ACCESS_VIOLATION";
    case EXCEPTION_ILLEGAL_INSTRUCTION: return "ILLEGAL_INSTRUCTION";
    case EXCEPTION_INT_DIVIDE_BY_ZERO: return "INTEGER_DIVIDE_BY_ZERO";
    case 0xC0000409u: return "STACK_BUFFER_OVERRUN_OR_FAST_FAIL";
    case 0x40000015u: return "FATAL_APP_EXIT";
    default: return "OTHER_EXCEPTION";
  }
}

NodeStepResult runNodeStep(const char* step, const std::wstring& node,
                           const std::vector<std::wstring>& arguments,
                           DWORD expectedExit, const Environment& environment,
                           const std::wstring& workspace, PSID sid) {
  SECURITY_ATTRIBUTES pipeSecurity{};
  pipeSecurity.nLength = sizeof(pipeSecurity);
  pipeSecurity.bInheritHandle = TRUE;
  HANDLE stdoutRead = nullptr;
  HANDLE stdoutWrite = nullptr;
  HANDLE stderrRead = nullptr;
  HANDLE stderrWrite = nullptr;
  if (!CreatePipe(&stdoutRead, &stdoutWrite, &pipeSecurity, 0) ||
      !CreatePipe(&stderrRead, &stderrWrite, &pipeSecurity, 0) ||
      !SetHandleInformation(stdoutRead, HANDLE_FLAG_INHERIT, 0) ||
      !SetHandleInformation(stderrRead, HANDLE_FLAG_INHERIT, 0)) {
    if (stdoutRead) CloseHandle(stdoutRead);
    if (stdoutWrite) CloseHandle(stdoutWrite);
    if (stderrRead) CloseHandle(stderrRead);
    if (stderrWrite) CloseHandle(stderrWrite);
    return {step, false, false, 0, "pipe", "EMPTY", "NATIVE_ABORT_NO_MESSAGE",
      "UNKNOWN", "none", false};
  }

  HANDLE job = CreateJobObjectW(nullptr, nullptr);
  JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};
  limits.BasicLimitInformation.LimitFlags =
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | JOB_OBJECT_LIMIT_ACTIVE_PROCESS;
  limits.BasicLimitInformation.ActiveProcessLimit = 1;
  if (job == nullptr || !SetInformationJobObject(
      job, JobObjectExtendedLimitInformation, &limits, sizeof(limits))) {
    if (job) CloseHandle(job);
    CloseHandle(stdoutRead); CloseHandle(stdoutWrite);
    CloseHandle(stderrRead); CloseHandle(stderrWrite);
    return {step, false, false, 0, "job", "EMPTY", "NATIVE_ABORT_NO_MESSAGE",
      "UNKNOWN", "none", false};
  }

  SECURITY_CAPABILITIES capabilities{};
  capabilities.AppContainerSid = sid;
  capabilities.CapabilityCount = 0;
  capabilities.Capabilities = nullptr;
  SIZE_T attributeSize = 0;
  InitializeProcThreadAttributeList(nullptr, 1, 0, &attributeSize);
  auto* attributes = reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(
    HeapAlloc(GetProcessHeap(), HEAP_ZERO_MEMORY, attributeSize)
  );
  bool attributesReady = attributes != nullptr && InitializeProcThreadAttributeList(
    attributes, 1, 0, &attributeSize) && UpdateProcThreadAttribute(
      attributes, 0, PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES,
      &capabilities, sizeof(capabilities), nullptr, nullptr
    );
  if (!attributesReady) {
    if (attributes) HeapFree(GetProcessHeap(), 0, attributes);
    CloseHandle(job); CloseHandle(stdoutRead); CloseHandle(stdoutWrite);
    CloseHandle(stderrRead); CloseHandle(stderrWrite);
    return {step, false, false, 0, "attributes", "EMPTY", "NATIVE_ABORT_NO_MESSAGE",
      "UNKNOWN", "none", false};
  }

  std::wstring command = quote(node);
  for (const std::wstring& argument : arguments) command += L" " + quote(argument);
  std::vector<wchar_t> commandLine(command.begin(), command.end());
  commandLine.push_back(L'\0');
  STARTUPINFOEXW startup{};
  startup.StartupInfo.cb = sizeof(startup);
  startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
  startup.StartupInfo.hStdOutput = stdoutWrite;
  startup.StartupInfo.hStdError = stderrWrite;
  startup.lpAttributeList = attributes;
  PROCESS_INFORMATION process{};
  const BOOL created = CreateProcessW(
    node.c_str(), commandLine.data(), nullptr, nullptr, TRUE,
    CREATE_SUSPENDED | CREATE_UNICODE_ENVIRONMENT | EXTENDED_STARTUPINFO_PRESENT |
      DEBUG_ONLY_THIS_PROCESS,
    const_cast<wchar_t*>(environment.block.data()), workspace.c_str(),
    &startup.StartupInfo, &process
  );
  CloseHandle(stdoutWrite);
  CloseHandle(stderrWrite);
  DeleteProcThreadAttributeList(attributes);
  HeapFree(GetProcessHeap(), 0, attributes);
  if (!created) {
    CloseHandle(job); CloseHandle(stdoutRead); CloseHandle(stderrRead);
    return {step, false, false, 0, "process-create", "EMPTY",
      "NATIVE_ABORT_NO_MESSAGE", "UNKNOWN", "none", false};
  }
  if (!AssignProcessToJobObject(job, process.hProcess) ||
      ResumeThread(process.hThread) == static_cast<DWORD>(-1)) {
    TerminateJobObject(job, ERROR_ACCESS_DENIED);
    WaitForSingleObject(process.hProcess, INFINITE);
    CloseHandle(process.hThread); CloseHandle(process.hProcess);
    CloseHandle(job); CloseHandle(stdoutRead); CloseHandle(stderrRead);
    return {step, true, false, 0, "process-policy", "EMPTY",
      "NATIVE_ABORT_NO_MESSAGE", "UNKNOWN", "none", false};
  }

  NodeCapture stdoutCapture;
  NodeCapture stderrCapture;
  std::thread stdoutReader(readNodePipe, stdoutRead, &stdoutCapture);
  std::thread stderrReader(readNodePipe, stderrRead, &stderrCapture);
  bool processExited = false;
  bool timedOut = false;
  bool debugError = false;
  bool nativeEventObserved = false;
  bool initialBreakpointObserved = false;
  bool hasExceptionCode = false;
  DWORD exceptionCode = 0;
  bool hasFirstChance = false;
  bool firstChance = false;
  bool hasExitProcessCode = false;
  DWORD exitProcessCode = 0;
  const char* exceptionClass = "NONE";
  const ULONGLONG deadline = GetTickCount64() + kWaitMilliseconds;
  while (!processExited) {
    DEBUG_EVENT event{};
    const BOOL received = WaitForDebugEvent(&event, 50);
    if (!received) {
      const DWORD error = GetLastError();
      if (WaitForSingleObject(process.hProcess, 0) == WAIT_OBJECT_0) {
        processExited = true;
        break;
      }
      if (error != ERROR_SEM_TIMEOUT) {
        debugError = true;
        break;
      }
      if (!timedOut && GetTickCount64() >= deadline) {
        timedOut = true;
        TerminateJobObject(job, WAIT_TIMEOUT);
      }
      continue;
    }

    DWORD continueStatus = DBG_CONTINUE;
    switch (event.dwDebugEventCode) {
      case CREATE_PROCESS_DEBUG_EVENT:
        if (event.u.CreateProcessInfo.hFile != nullptr) {
          CloseHandle(event.u.CreateProcessInfo.hFile);
        }
        break;
      case LOAD_DLL_DEBUG_EVENT:
        if (event.u.LoadDll.hFile != nullptr) CloseHandle(event.u.LoadDll.hFile);
        break;
      case EXCEPTION_DEBUG_EVENT: {
        nativeEventObserved = true;
        const EXCEPTION_DEBUG_INFO& exception = event.u.Exception;
        const DWORD code = exception.ExceptionRecord.ExceptionCode;
        const bool isInitialBreakpoint =
          code == EXCEPTION_BREAKPOINT && exception.dwFirstChance != FALSE &&
          !hasExceptionCode;
        if (isInitialBreakpoint) {
          initialBreakpointObserved = true;
        } else {
          hasExceptionCode = true;
          exceptionCode = code;
          hasFirstChance = true;
          firstChance = exception.dwFirstChance != FALSE;
          exceptionClass = exceptionClassName(code);
          continueStatus = DBG_EXCEPTION_NOT_HANDLED;
        }
        break;
      }
      case EXIT_PROCESS_DEBUG_EVENT:
        nativeEventObserved = true;
        hasExitProcessCode = true;
        exitProcessCode = event.u.ExitProcess.dwExitCode;
        processExited = true;
        break;
      default:
        break;
    }
    if (!ContinueDebugEvent(event.dwProcessId, event.dwThreadId, continueStatus)) {
      debugError = true;
      break;
    }
    if (!timedOut && GetTickCount64() >= deadline) {
      timedOut = true;
      TerminateJobObject(job, WAIT_TIMEOUT);
    }
  }
  if (!processExited && !timedOut) {
    debugError = true;
    TerminateJobObject(job, ERROR_PROCESS_ABORTED);
  }
  if (!processExited) {
    timedOut = true;
    TerminateJobObject(job, WAIT_TIMEOUT);
    WaitForSingleObject(process.hProcess, INFINITE);
  }
  DWORD exitCode = WAIT_TIMEOUT;
  const bool hasExitCode = GetExitCodeProcess(process.hProcess, &exitCode) != FALSE;
  CloseHandle(process.hThread); CloseHandle(process.hProcess);
  CloseHandle(stdoutRead); CloseHandle(stderrRead);
  stdoutReader.join(); stderrReader.join();
  CloseHandle(job);

  const bool overflow = stdoutCapture.overflow || stderrCapture.overflow;
  const char* stderrClass = overflow ? "OUTPUT_LIMIT" :
    stderrCapture.value.find("Native stack trace") != std::string::npos
      ? "NATIVE_ABORT"
      : stderrCapture.value.empty() ? "EMPTY" : "OTHER";
  const char* stage = timedOut ? "timeout" : debugError ? "debug-loop" : "complete";
  NodeStepResult result{
    step, true, hasExitCode, exitCode, stage, stderrClass,
    sanitizedFatalReason(stderrCapture.value), fatalSubsystem(stderrCapture.value),
    firstNodeNativeFrame(stderrCapture.value),
    !overflow && !timedOut && !debugError && hasExitCode && exitCode == expectedExit
  };
  result.nativeEventObserved = nativeEventObserved;
  result.initialBreakpointObserved = initialBreakpointObserved;
  result.hasExceptionCode = hasExceptionCode;
  result.exceptionCode = exceptionCode;
  result.hasFirstChance = hasFirstChance;
  result.firstChance = firstChance;
  result.hasExitProcessCode = hasExitProcessCode;
  result.exitProcessCode = hasExitProcessCode ? exitProcessCode : exitCode;
  result.exceptionClass = hasExceptionCode ? exceptionClass : "NONE";
  result.terminationClass = timedOut ? "EXTERNAL_JOB_TIMEOUT" :
    hasExceptionCode && !firstChance ? "UNHANDLED_EXCEPTION" :
    processExited ? "EXIT_PROCESS_ONLY" : "UNKNOWN";
  result.terminationOrigin = timedOut ? "JOB_OBJECT" :
    hasExceptionCode ? "DEBUG_EVENT" :
    processExited ? "PROCESS_EXIT_EVENT" : "INDETERMINATE";
  result.debugLoopStatus = debugError ? "ERROR" : timedOut ? "TIMEOUT" : "COMPLETE";
  result.nativeFrames = nodeNativeFrames(stderrCapture.value);
  return result;
}

void reportNodeStep(const NodeStepResult& result, bool cleanup) {
  std::cout << "step=" << result.step
            << " processCreated=" << (result.processCreated ? "true" : "false")
            << " exitCode=";
  if (result.hasExitCode) std::cout << result.exitCode;
  else std::cout << "null";
  std::cout << " stage=" << result.stage
            << " stderrClass=" << result.stderrClass
            << " fatalReason=" << result.fatalReason
            << " subsystem=" << result.subsystem
            << " nativeEventObserved=" << (result.nativeEventObserved ? "true" : "false")
            << " exceptionCode=";
  if (result.hasExceptionCode) {
    std::cout << "0x" << std::hex << std::uppercase << result.exceptionCode << std::dec;
  } else {
    std::cout << "NOT_OBSERVED";
  }
  std::cout << " exceptionClass=" << result.exceptionClass
            << " firstChance=";
  if (result.hasFirstChance) std::cout << (result.firstChance ? "true" : "false");
  else std::cout << "NOT_APPLICABLE";
  std::cout << " terminationClass=" << result.terminationClass
            << " terminationOrigin=" << result.terminationOrigin
            << " exitProcessCode=";
  if (result.hasExitProcessCode) std::cout << result.exitProcessCode;
  else std::cout << "NOT_OBSERVED";
  std::cout << " debugLoopStatus=" << result.debugLoopStatus
            << " firstNativeFrame=" << result.firstNativeFrame
            << " nativeFrames=" << result.nativeFrames
            << " markerPresent=true"
            << " cleanup=" << (cleanup ? "PASS" : "FAIL") << '\n';
}

int runNodeStartupDiagnostic(const std::wstring& requestedNode) {
  std::error_code filesystemError;
  if (!fs::path(requestedNode).is_absolute() ||
      !equalName(fs::path(requestedNode).filename().wstring(), L"node.exe") ||
      !fs::is_regular_file(requestedNode, filesystemError) || filesystemError) {
    return fail({"node-absolute", ERROR_BAD_PATHNAME});
  }
  const fs::path canonicalNode = fs::canonical(requestedNode, filesystemError);
  if (filesystemError || canonicalNode.empty()) {
    return fail({"node-canonical", static_cast<DWORD>(filesystemError.value())});
  }

  const fs::path stage = fs::temp_directory_path(filesystemError) /
    (L"sdo-node-startup-diagnostic-" + std::to_wstring(GetCurrentProcessId()));
  const fs::path stagedWorkspace = stage / L"workspace";
  const fs::path stagedNodeDirectory = stage / L"node";
  fs::create_directories(stagedWorkspace, filesystemError);
  if (filesystemError) return fail({"node-staging", static_cast<DWORD>(filesystemError.value())});

  DiagnosticFailure failure{};
  if (!copyNodeTree(canonicalNode.parent_path(), stagedNodeDirectory, &failure)) {
    fs::remove_all(stage, filesystemError);
    return fail(failure);
  }
  const fs::path stagedNode = stagedNodeDirectory / canonicalNode.filename();
  const fs::path minimalScript = stagedWorkspace / L"minimal.js";
  const fs::path minimalTest = stagedWorkspace / L"minimal.test.js";
  static constexpr char kMinimalSource[] =
    "'use strict';\n"
    "const fs = require('node:fs');\n"
    "fs.readFileSync(__filename, 'utf8');\n"
    "process.exit(37);\n";
  static constexpr char kMinimalTestSource[] =
    "'use strict';\n"
    "const test = require('node:test');\n"
    "const assert = require('node:assert/strict');\n"
    "const fs = require('node:fs');\n"
    "test('minimal staging-only fixture', () => {\n"
    "  assert.match(fs.readFileSync(__filename, 'utf8'), /staging-only/);\n"
    "});\n";
  if (!writeNodeFixture(minimalScript, kMinimalSource, &failure) ||
      !writeNodeFixture(minimalTest, kMinimalTestSource, &failure)) {
    fs::remove_all(stage, filesystemError);
    return fail(failure);
  }

  const std::wstring profileName =
    L"SdoNodeStartupDiagnostic-" + std::to_wstring(GetCurrentProcessId());
  PSID sid = nullptr;
  const HRESULT profileResult = CreateAppContainerProfile(
    profileName.c_str(), L"SDO Node startup diagnostic", L"SDO Node startup diagnostic",
    nullptr, 0, &sid
  );
  if (FAILED(profileResult) || sid == nullptr) {
    fs::remove_all(stage, filesystemError);
    return fail({"node-appcontainer-profile", win32CodeFromHresult(profileResult)});
  }

  LPWSTR sidText = nullptr;
  PWSTR profilePathRaw = nullptr;
  if (!ConvertSidToStringSidW(sid, &sidText) ||
      FAILED(GetAppContainerFolderPath(sidText, &profilePathRaw)) || profilePathRaw == nullptr) {
    if (sidText) LocalFree(sidText);
    if (profilePathRaw) CoTaskMemFree(profilePathRaw);
    DeleteAppContainerProfile(profileName.c_str());
    FreeSid(sid);
    fs::remove_all(stage, filesystemError);
    return fail({"node-appcontainer-folder", GetLastError()});
  }
  const std::wstring profilePath(profilePathRaw);
  LocalFree(sidText);
  CoTaskMemFree(profilePathRaw);

  Environment environment;
  PSECURITY_DESCRIPTOR oldDescriptor = nullptr;
  PACL oldDacl = nullptr;
  if (!productionNodeEnvironment(
        stagedNodeDirectory.wstring(), stagedWorkspace.wstring(), profilePath,
        &environment, &failure) ||
      !grantAppContainerReadExecute(
        stage.wstring(), sid, &oldDescriptor, &oldDacl, &failure)) {
    if (oldDescriptor) {
      DiagnosticFailure ignoredCleanup{};
      restoreDacl(stage.wstring(), oldDescriptor, oldDacl, &ignoredCleanup);
      LocalFree(oldDescriptor);
    }
    DeleteAppContainerProfile(profileName.c_str());
    FreeSid(sid);
    fs::remove_all(stage, filesystemError);
    return fail(failure);
  }

  const std::wstring allowRead = L"--allow-fs-read=" + stagedWorkspace.wstring();
  const std::vector<std::pair<NodeStepResult, bool>> attempted = [&]() {
    std::vector<std::pair<NodeStepResult, bool>> results;
    const auto attempt = [&](const char* step, std::vector<std::wstring> arguments,
                             DWORD expectedExit) {
      NodeStepResult result = runNodeStep(
        step, stagedNode.wstring(), arguments, expectedExit, environment,
        stagedWorkspace.wstring(), sid
      );
      results.emplace_back(result, result.expected);
      return result.expected;
    };
    auto control = runNodeStep("N1", stagedNode.wstring(), {L"--version"}, 0,
      environment, stagedWorkspace.wstring(), sid);
    results.emplace_back(control, control.expected);
    std::cout << "state=CONTROL_N1 evidence=" << (control.expected ? "PASS" : "EXIT_134")
      << " nextState=" << (control.expected ? "BLOCKED" : "TEST_USERPROFILE_ONLY")
      << " equivalentAttempts=1 breakerDecision=" << (control.expected ? "CONTROL_NOT_REPRODUCED" : "CONTINUE") << '\n';
    if (control.expected) return results;
    const fs::path userProfileDir = stage / L"userprofile-variant";
    fs::create_directories(userProfileDir, filesystemError);
    Environment userProfileEnvironment = environmentVariant(environment, L"USERPROFILE", userProfileDir.wstring());
    auto userProfile = runNodeStep("N1", stagedNode.wstring(), {L"--version"}, 0,
      userProfileEnvironment, stagedWorkspace.wstring(), sid);
    results.emplace_back(userProfile, userProfile.expected);
    std::cout << "state=TEST_USERPROFILE_ONLY evidence=" << (userProfile.expected ? "PASS" : "EXIT_134")
      << " nextState=" << (userProfile.expected ? "VERIFY_USERPROFILE_CONTROL" : "TEST_APPDATA_ONLY")
      << " equivalentAttempts=2 breakerDecision=" << (userProfile.expected ? "VERIFY_CONTROL" : "CONTINUE") << '\n';
    if (userProfile.expected) {
      auto verify = runNodeStep("N1", stagedNode.wstring(), {L"--version"}, 0,
        environment, stagedWorkspace.wstring(), sid);
      results.emplace_back(verify, verify.expected);
      std::cout << "state=VERIFY_USERPROFILE_CONTROL evidence=" << (verify.expected ? "PASS" : "EXIT_134")
        << " nextState=COMPLETE equivalentAttempts=3 breakerDecision="
        << (verify.expected ? "INDETERMINATE" : "USERPROFILE_NECESSARY_AND_SUFFICIENT") << '\n';
      return results;
    }
    const fs::path appDataDir = stage / L"appdata-variant";
    fs::create_directories(appDataDir, filesystemError);
    Environment appDataEnvironment = environmentVariant(environment, L"APPDATA", appDataDir.wstring());
    auto appData = runNodeStep("N1", stagedNode.wstring(), {L"--version"}, 0,
      appDataEnvironment, stagedWorkspace.wstring(), sid);
    results.emplace_back(appData, appData.expected);
    std::cout << "state=TEST_APPDATA_ONLY evidence=" << (appData.expected ? "PASS" : "EXIT_134")
      << " nextState=COMPLETE equivalentAttempts=3 breakerDecision="
      << (appData.expected ? "VERIFY_CONTROL" : "USERPROFILE_APPDATA_REFUTED") << '\n';
    return results;
  }();

  DiagnosticFailure cleanupFailure{};
  const bool daclRestored = restoreDacl(
    stage.wstring(), oldDescriptor, oldDacl, &cleanupFailure
  );
  if (oldDescriptor) LocalFree(oldDescriptor);
  filesystemError.clear();
  fs::remove_all(stage, filesystemError);
  const bool stageRemoved = !filesystemError;
  const HRESULT profileCleanup = DeleteAppContainerProfile(profileName.c_str());
  FreeSid(sid);
  const bool cleanup = daclRestored && stageRemoved && profileCleanup == S_OK;
  for (const auto& entry : attempted) reportNodeStep(entry.first, cleanup);
  if (!cleanup || attempted.empty()) return 2;
  return attempted.back().second ? 0 : 1;
}

}  // namespace

int wmain(int argc, wchar_t* argv[]) {
  if (argc == 2 && std::wcscmp(argv[1], kChildArgument) == 0) {
    return static_cast<int>(kChildExit);
  }
  if (argc == 3 && std::wcscmp(argv[1], kNodeDiagnosticArgument) == 0) {
    return runNodeStartupDiagnostic(argv[2]);
  }
  if (argc != 1) return fail({"arguments", ERROR_BAD_ARGUMENTS});

  wchar_t modulePath[MAX_PATH]{};
  const DWORD moduleLength = GetModuleFileNameW(nullptr, modulePath, MAX_PATH);
  if (moduleLength == 0 || moduleLength >= MAX_PATH) {
    return fail({
      "module", moduleLength == 0 ? GetLastError() : ERROR_INSUFFICIENT_BUFFER
    });
  }

  std::error_code filesystemError;
  const fs::path stage = fs::temp_directory_path(filesystemError) /
    (L"sdo-environment-diagnostic-" + std::to_wstring(GetCurrentProcessId()));
  if (filesystemError || !fs::create_directory(stage, filesystemError) || filesystemError) {
    const DWORD error = filesystemError
      ? static_cast<DWORD>(filesystemError.value()) : ERROR_ALREADY_EXISTS;
    return fail({"staging-create", error});
  }
  const fs::path stagedWorkspace = stage / L"workspace";
  const fs::path stagedExecutableDirectory = stage / L"node";
  if (!fs::create_directory(stagedWorkspace, filesystemError) || filesystemError ||
      !fs::create_directory(stagedExecutableDirectory, filesystemError) || filesystemError) {
    const DWORD error = filesystemError
      ? static_cast<DWORD>(filesystemError.value()) : ERROR_ALREADY_EXISTS;
    std::error_code cleanupError;
    fs::remove_all(stage, cleanupError);
    return fail({"staging-layout", error});
  }
  const fs::path stagedExecutable =
    stagedExecutableDirectory / L"environment-diagnostic.exe";
  if (!fs::copy_file(
      fs::path(modulePath), stagedExecutable, fs::copy_options::none, filesystemError) ||
      filesystemError) {
    const DWORD error = filesystemError
      ? static_cast<DWORD>(filesystemError.value()) : ERROR_CANNOT_COPY;
    std::error_code cleanupError;
    fs::remove_all(stage, cleanupError);
    return fail({"staging-copy", error});
  }

  const std::wstring profileName =
    L"SdoEnvironmentDiagnostic-" + std::to_wstring(GetCurrentProcessId());
  PSID sid = nullptr;
  const HRESULT profileResult = CreateAppContainerProfile(
    profileName.c_str(), L"SDO environment diagnostic", L"SDO environment diagnostic",
    nullptr, 0, &sid
  );
  if (FAILED(profileResult) || sid == nullptr) {
    fs::remove_all(stage, filesystemError);
    return fail({"appcontainer-profile", win32CodeFromHresult(profileResult)});
  }

  LPWSTR sidText = nullptr;
  if (!ConvertSidToStringSidW(sid, &sidText)) {
    const DWORD sidError = GetLastError();
    DeleteAppContainerProfile(profileName.c_str());
    FreeSid(sid);
    fs::remove_all(stage, filesystemError);
    return fail({"appcontainer-sid-text", sidError});
  }
  PWSTR profilePathRaw = nullptr;
  const HRESULT profilePathResult = GetAppContainerFolderPath(sidText, &profilePathRaw);
  LocalFree(sidText);
  if (FAILED(profilePathResult) || profilePathRaw == nullptr) {
    DeleteAppContainerProfile(profileName.c_str());
    FreeSid(sid);
    fs::remove_all(stage, filesystemError);
    return fail({"appcontainer-folder", win32CodeFromHresult(profilePathResult)});
  }
  const fs::path profilePath(profilePathRaw);
  CoTaskMemFree(profilePathRaw);
  const fs::path profileTempPath = profilePath / L"Temp";
  std::error_code profileFsError;
  const bool profileDirectoryExists = fs::is_directory(profilePath, profileFsError) &&
    !profileFsError;
  if (!profileDirectoryExists) {
    DeleteAppContainerProfile(profileName.c_str());
    FreeSid(sid);
    fs::remove_all(stage, filesystemError);
    return fail({"appcontainer-folder", ERROR_PATH_NOT_FOUND});
  }
  fs::create_directories(profileTempPath, profileFsError);
  const bool profileTempExists = fs::is_directory(profileTempPath, profileFsError) &&
    !profileFsError;
  if (!profileTempExists) {
    DeleteAppContainerProfile(profileName.c_str());
    FreeSid(sid);
    fs::remove_all(stage, filesystemError);
    return fail({"appcontainer-temp", ERROR_PATH_NOT_FOUND});
  }

  DiagnosticFailure failure{};
  PSECURITY_DESCRIPTOR oldDescriptor = nullptr;
  PACL oldDacl = nullptr;
  if (!grantAppContainerReadExecute(
      stage.wstring(), sid, &oldDescriptor, &oldDacl, &failure)) {
    if (oldDescriptor != nullptr) {
      DiagnosticFailure ignoredCleanup{};
      restoreDacl(stage.wstring(), oldDescriptor, oldDacl, &ignoredCleanup);
      LocalFree(oldDescriptor);
    }
    DeleteAppContainerProfile(profileName.c_str());
    FreeSid(sid);
    fs::remove_all(stage, filesystemError);
    return fail(failure);
  }

  HANDLE token = nullptr;
  if (!OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY | TOKEN_DUPLICATE, &token)) {
    failure = {"token-open", GetLastError()};
  }

  Environment manual;
  Environment nativeSanitized;
  Environment minimalNative;
  if (failure.stage == nullptr &&
      !manualCurrentEnvironment(
        stagedWorkspace.wstring(), stagedExecutableDirectory.wstring(), &manual, &failure)) {
    if (failure.stage == nullptr) failure = {"manual-environment", ERROR_BAD_ENVIRONMENT};
  }
  if (failure.stage == nullptr &&
      !nativeSanitizedEnvironment(
        token, stagedWorkspace.wstring(), stagedExecutableDirectory.wstring(), true,
        &nativeSanitized, &failure)) {
    if (failure.stage == nullptr) failure = {"native-environment", ERROR_BAD_ENVIRONMENT};
  }
  if (failure.stage == nullptr &&
      !nativeSanitizedEnvironment(
        nullptr, stagedWorkspace.wstring(), stagedExecutableDirectory.wstring(), false,
        &minimalNative, &failure)) {
    if (failure.stage == nullptr) failure = {"minimal-native-environment", ERROR_BAD_ENVIRONMENT};
  }
  if (token != nullptr) CloseHandle(token);

  HANDLE job = nullptr;
  if (failure.stage == nullptr) {
    job = CreateJobObjectW(nullptr, nullptr);
    if (job == nullptr) failure = {"job-create", GetLastError()};
  }
  JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};
  limits.BasicLimitInformation.LimitFlags =
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | JOB_OBJECT_LIMIT_ACTIVE_PROCESS;
  limits.BasicLimitInformation.ActiveProcessLimit = 1;
  if (failure.stage == nullptr && !SetInformationJobObject(
      job, JobObjectExtendedLimitInformation, &limits, sizeof(limits))) {
    failure = {"job-limit", GetLastError()};
  }

  SECURITY_CAPABILITIES capabilities{};
  capabilities.AppContainerSid = sid;
  capabilities.CapabilityCount = 0;
  capabilities.Capabilities = nullptr;
  SIZE_T attributeSize = 0;
  LPPROC_THREAD_ATTRIBUTE_LIST attributes = nullptr;
  if (failure.stage == nullptr) {
    InitializeProcThreadAttributeList(nullptr, 1, 0, &attributeSize);
    const DWORD sizingError = GetLastError();
    if (sizingError != ERROR_INSUFFICIENT_BUFFER) {
      failure = {"attribute-list-size", sizingError};
    }
  }
  if (failure.stage == nullptr) {
    attributes = reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(
      HeapAlloc(GetProcessHeap(), HEAP_ZERO_MEMORY, attributeSize)
    );
    if (attributes == nullptr) failure = {"attribute-list-allocate", ERROR_NOT_ENOUGH_MEMORY};
  }
  if (failure.stage == nullptr && !InitializeProcThreadAttributeList(
      attributes, 1, 0, &attributeSize)) {
    failure = {"attribute-list-initialize", GetLastError()};
  }
  if (failure.stage == nullptr && !UpdateProcThreadAttribute(
      attributes, 0, PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES,
      &capabilities, sizeof(capabilities), nullptr, nullptr)) {
    failure = {"security-capabilities", GetLastError()};
  }

  PathMetadata executableMetadata{};
  PathMetadata workspaceMetadata{};
  PathMetadata executableDirectoryMetadata{};
  if (failure.stage == nullptr) {
    validateAppContainerPath(
      stagedExecutable.wstring(), false, "environment-diagnostic.exe", sid,
      &executableMetadata, &failure
    );
  }
  if (failure.stage == nullptr) {
    validateAppContainerPath(
      stagedWorkspace.wstring(), true, "workspace", sid,
      &workspaceMetadata, &failure
    );
  }
  if (failure.stage == nullptr) {
    validateAppContainerPath(
      stagedExecutableDirectory.wstring(), true, "node", sid,
      &executableDirectoryMetadata, &failure
    );
  }

  std::vector<wchar_t> originalCurrentDirectory;
  bool currentDirectoryConfined = false;
  if (failure.stage == nullptr) {
    const DWORD required = GetCurrentDirectoryW(0, nullptr);
    const DWORD currentDirectoryError = required == 0 ? GetLastError() : ERROR_SUCCESS;
    if (required == 0) {
      failure = {"current-directory-read", currentDirectoryError};
    } else {
      originalCurrentDirectory.resize(required);
      const DWORD copied = GetCurrentDirectoryW(required, originalCurrentDirectory.data());
      if (copied == 0 || copied >= required) {
        failure = {
          "current-directory-read",
          copied == 0 ? GetLastError() : ERROR_INSUFFICIENT_BUFFER
        };
      }
    }
  }
  if (failure.stage == nullptr) {
    currentDirectoryConfined = SetCurrentDirectoryW(stagedWorkspace.c_str()) != FALSE;
    if (!currentDirectoryConfined) {
      failure = {"current-directory-confine", GetLastError()};
    }
  }

  bool variantsComplete = false;
  bool argumentVariantsRan = false;
  VariantResult d{};
  VariantResult e{};
  VariantResult f{};
  VariantResult g{};
  VariantResult h{};
  VariantResult i{};
  VariantResult j{};
  VariantResult k{};
  Environment profileLocalAppData;
  Environment profileComplete;
  ProfileEnvironmentMetadata profileMetadata{
    false, false, false, profileDirectoryExists, profileTempExists
  };
  ProfileEnvironmentMetadata localAppDataMetadata{
    true, false, false, profileDirectoryExists, profileTempExists
  };
  ProfileEnvironmentMetadata completeMetadata{
    true, true, true, profileDirectoryExists, profileTempExists
  };
  if (failure.stage == nullptr) {
    const VariantResult a = runVariant(
      stagedExecutable.wstring(), stagedWorkspace.c_str(), manual, attributes, job
    );
    reportVariant("A", "manual", metadata(manual), a);
    d = runVariant(
      stagedExecutable.wstring(), stagedWorkspace.c_str(), nativeSanitized, attributes, job
    );
    const VariantResult c = runVariant(
      stagedExecutable.wstring(), stagedWorkspace.c_str(), minimalNative, attributes, job
    );
    reportVariant("C", "minimal-native", metadata(minimalNative), c);
    e = runVariant(
      stagedExecutable.wstring(), nullptr, nativeSanitized, attributes, job
    );
    f = runVariant(
      stagedExecutable.wstring(), stagedExecutableDirectory.c_str(), nativeSanitized,
      attributes, job
    );
    g = runVariant(
      stagedExecutable.wstring(), stagedWorkspace.c_str(), nativeSanitized, attributes, job,
      true
    );
    h = runVariant(
      stagedExecutable.wstring(), stagedWorkspace.c_str(), nativeSanitized, attributes, job,
      false
    );
    profileLocalAppData = profileEnvironment(nativeSanitized, profilePath.wstring(), false);
    profileComplete = profileEnvironment(nativeSanitized, profilePath.wstring(), true);
    i = runVariant(stagedExecutable.wstring(), stagedWorkspace.c_str(), nativeSanitized,
                   attributes, job);
    j = runVariant(stagedExecutable.wstring(), stagedWorkspace.c_str(), profileLocalAppData,
                   attributes, job);
    k = runVariant(stagedExecutable.wstring(), stagedWorkspace.c_str(), profileComplete,
                   attributes, job);
    argumentVariantsRan = true;
    variantsComplete =
      (!a.createProcess || (a.hasChildExit && a.childExit == kChildExit)) &&
      (!d.createProcess || (d.hasChildExit && d.childExit == kChildExit)) &&
      (!c.createProcess || (c.hasChildExit && c.childExit == kChildExit)) &&
      (!e.createProcess || (e.hasChildExit && e.childExit == kChildExit)) &&
      (!f.createProcess || (f.hasChildExit && f.childExit == kChildExit)) &&
      (!g.createProcess || (g.hasChildExit && g.childExit == kChildExit)) &&
      (!h.createProcess || (h.hasChildExit && h.childExit == kChildExit));
    variantsComplete = variantsComplete &&
      (!i.createProcess || (i.hasChildExit && i.childExit == kChildExit)) &&
      (!j.createProcess || (j.hasChildExit && j.childExit == kChildExit)) &&
      (!k.createProcess || (k.hasChildExit && k.childExit == kChildExit));
    if (!variantsComplete) failure = {"variant-containment", ERROR_PROCESS_ABORTED};
  }

  bool currentDirectoryRestored = !currentDirectoryConfined;
  if (currentDirectoryConfined) {
    currentDirectoryRestored =
      SetCurrentDirectoryW(originalCurrentDirectory.data()) != FALSE;
    if (!currentDirectoryRestored && failure.stage == nullptr) {
      failure = {"current-directory-restore", GetLastError()};
    }
  }

  if (attributes != nullptr) {
    DeleteProcThreadAttributeList(attributes);
    HeapFree(GetProcessHeap(), 0, attributes);
  }
  if (job != nullptr) CloseHandle(job);

  DiagnosticFailure cleanupFailure{};
  const bool daclRestored = restoreDacl(
    stage.wstring(), oldDescriptor, oldDacl, &cleanupFailure
  );
  if (oldDescriptor != nullptr) LocalFree(oldDescriptor);
  filesystemError.clear();
  fs::remove_all(stage, filesystemError);
  const bool stageRemoved = !filesystemError;
  const HRESULT profileCleanup = DeleteAppContainerProfile(profileName.c_str());
  FreeSid(sid);

  const bool cleanupPassed = currentDirectoryRestored && daclRestored && stageRemoved &&
    profileCleanup == S_OK;
  if (argumentVariantsRan) {
    reportArgumentVariant(
      "D", "explicit-workspace", executableMetadata, workspaceMetadata, d,
      cleanupPassed
    );
    reportArgumentVariant(
      "E", "null-confined-parent", executableMetadata, workspaceMetadata, e,
      cleanupPassed
    );
    reportArgumentVariant(
      "F", "explicit-executable-directory", executableMetadata,
      executableDirectoryMetadata, f, cleanupPassed
    );
    reportArgumentVariant(
      "G", "explicit-workspace", executableMetadata, workspaceMetadata, g,
      cleanupPassed, true
    );
    reportArgumentVariant(
      "H", "explicit-workspace", executableMetadata, workspaceMetadata, h,
      cleanupPassed, false
    );
    reportProfileVariant("I", nativeSanitized,
      profileMetadata, i, cleanupPassed);
    reportProfileVariant("J", profileLocalAppData, localAppDataMetadata, j, cleanupPassed);
    reportProfileVariant("K", profileComplete, completeMetadata, k, cleanupPassed);
  }

  if (failure.stage != nullptr) return fail(failure);
  if (!daclRestored) return fail(cleanupFailure);
  if (!stageRemoved) {
    return fail({"staging-cleanup", static_cast<DWORD>(filesystemError.value())});
  }
  if (profileCleanup != S_OK) {
    return fail({"profile-cleanup", win32CodeFromHresult(profileCleanup)});
  }
  return variantsComplete ? 0 : 2;
}
