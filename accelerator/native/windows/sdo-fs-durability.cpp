#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#include <windows.h>
#include <aclapi.h>

#include <iostream>
#include <string>
#include <vector>

namespace {

std::string utf8(const std::wstring& value) {
  if (value.empty()) return std::string();
  int size = WideCharToMultiByte(
    CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()),
    nullptr, 0, nullptr, nullptr
  );
  if (size <= 0) return std::string();
  std::string result(static_cast<size_t>(size), '\0');
  if (WideCharToMultiByte(
        CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()),
        result.data(), size, nullptr, nullptr) != size) {
    return std::string();
  }
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

int fail(const wchar_t* operation, DWORD errorCode) {
  std::cout << "{\"schema\":\"sdo.windows_native_durability_helper.v1\","
               "\"decision\":\"FAILED\",\"operation\":";
  printJsonString(operation);
  std::cout << ",\"win32Error\":" << errorCode << "}" << std::endl;
  return 2;
}

int flushDirectory(const std::wstring& directory) {
  HANDLE handle = CreateFileW(
    directory.c_str(),
    GENERIC_READ | GENERIC_WRITE,
    FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
    nullptr,
    OPEN_EXISTING,
    FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
    nullptr
  );

  if (handle == INVALID_HANDLE_VALUE) {
    return fail(L"FLUSH_DIRECTORY", GetLastError());
  }

  FILE_ATTRIBUTE_TAG_INFO tagInfo{};
  if (!GetFileInformationByHandleEx(
        handle, FileAttributeTagInfo, &tagInfo, sizeof(tagInfo))) {
    DWORD error = GetLastError();
    CloseHandle(handle);
    return fail(L"FLUSH_DIRECTORY", error);
  }

  if ((tagInfo.FileAttributes & FILE_ATTRIBUTE_DIRECTORY) == 0 ||
      (tagInfo.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0) {
    CloseHandle(handle);
    return fail(L"FLUSH_DIRECTORY", ERROR_REPARSE_TAG_INVALID);
  }

  if (!FlushFileBuffers(handle)) {
    DWORD error = GetLastError();
    CloseHandle(handle);
    return fail(L"FLUSH_DIRECTORY", error);
  }

  BY_HANDLE_FILE_INFORMATION info{};
  if (!GetFileInformationByHandle(handle, &info)) {
    DWORD error = GetLastError();
    CloseHandle(handle);
    return fail(L"FLUSH_DIRECTORY", error);
  }

  CloseHandle(handle);

  const unsigned long long fileIndex =
    (static_cast<unsigned long long>(info.nFileIndexHigh) << 32) |
    static_cast<unsigned long long>(info.nFileIndexLow);

  std::cout << "{\"schema\":\"sdo.windows_native_durability_helper.v1\","
               "\"decision\":\"CONFIRMED\","
               "\"operation\":\"FLUSH_DIRECTORY\","
               "\"primitive\":\"CreateFileW+FlushFileBuffers\","
               "\"volumeSerialNumber\":" << info.dwVolumeSerialNumber << ","
               "\"fileIndex\":\"" << fileIndex << "\","
               "\"subject\":";
  printJsonString(directory);
  std::cout << "}" << std::endl;
  return 0;
}

bool currentUserSid(std::vector<BYTE>* storage, PSID* sid, DWORD* error) {
  HANDLE token = nullptr;
  if (!OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &token)) {
    *error = GetLastError();
    return false;
  }
  DWORD bytes = 0;
  GetTokenInformation(token, TokenUser, nullptr, 0, &bytes);
  if (GetLastError() != ERROR_INSUFFICIENT_BUFFER || bytes == 0) {
    *error = GetLastError();
    CloseHandle(token);
    return false;
  }
  storage->resize(bytes);
  if (!GetTokenInformation(token, TokenUser, storage->data(), bytes, &bytes)) {
    *error = GetLastError();
    CloseHandle(token);
    return false;
  }
  CloseHandle(token);
  *sid = reinterpret_cast<TOKEN_USER*>(storage->data())->User.Sid;
  if (!IsValidSid(*sid)) {
    *error = ERROR_INVALID_SID;
    return false;
  }
  return true;
}

bool wellKnownSid(WELL_KNOWN_SID_TYPE type, BYTE* storage, DWORD storageSize,
                  PSID* sid, DWORD* error) {
  DWORD bytes = storageSize;
  if (!CreateWellKnownSid(type, nullptr, storage, &bytes)) {
    *error = GetLastError();
    return false;
  }
  *sid = storage;
  return true;
}

bool regularNonReparse(HANDLE handle, DWORD* error) {
  FILE_ATTRIBUTE_TAG_INFO tagInfo{};
  if (!GetFileInformationByHandleEx(
        handle, FileAttributeTagInfo, &tagInfo, sizeof(tagInfo))) {
    *error = GetLastError();
    return false;
  }
  if ((tagInfo.FileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0 ||
      (tagInfo.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0) {
    *error = ERROR_REPARSE_TAG_INVALID;
    return false;
  }
  return true;
}

bool ownerIsCurrentUser(HANDLE handle, PSID currentSid, DWORD* error) {
  PSID owner = nullptr;
  PSECURITY_DESCRIPTOR descriptor = nullptr;
  const DWORD result = GetSecurityInfo(
    handle, SE_FILE_OBJECT, OWNER_SECURITY_INFORMATION,
    &owner, nullptr, nullptr, nullptr, &descriptor
  );
  if (result != ERROR_SUCCESS) {
    *error = result;
    return false;
  }
  const bool matches = owner != nullptr && IsValidSid(owner) &&
    EqualSid(owner, currentSid) != FALSE;
  LocalFree(descriptor);
  if (!matches) *error = ERROR_INVALID_OWNER;
  return matches;
}

bool applyPrivateKeyAcl(HANDLE handle, PSID currentSid, PSID systemSid,
                        PSID administratorsSid, DWORD* error) {
  EXPLICIT_ACCESSW entries[3]{};
  PSID principals[3] = { currentSid, systemSid, administratorsSid };
  TRUSTEE_TYPE types[3] = { TRUSTEE_IS_USER, TRUSTEE_IS_WELL_KNOWN_GROUP,
                            TRUSTEE_IS_GROUP };
  for (size_t index = 0; index < 3; ++index) {
    entries[index].grfAccessPermissions = FILE_ALL_ACCESS;
    entries[index].grfAccessMode = GRANT_ACCESS;
    entries[index].grfInheritance = NO_INHERITANCE;
    entries[index].Trustee.TrusteeForm = TRUSTEE_IS_SID;
    entries[index].Trustee.TrusteeType = types[index];
    entries[index].Trustee.ptstrName = reinterpret_cast<LPWSTR>(principals[index]);
  }

  PACL dacl = nullptr;
  DWORD result = SetEntriesInAclW(3, entries, nullptr, &dacl);
  if (result != ERROR_SUCCESS) {
    *error = result;
    return false;
  }
  result = SetSecurityInfo(
    handle, SE_FILE_OBJECT,
    DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
    nullptr, nullptr, dacl, nullptr
  );
  LocalFree(dacl);
  if (result != ERROR_SUCCESS) {
    *error = result;
    return false;
  }
  return true;
}

int verifyPrivateKeyAcl(const std::wstring& subject, const wchar_t* operation,
                        const char* primitive) {
  HANDLE handle = CreateFileW(
    subject.c_str(), GENERIC_READ | READ_CONTROL,
    FILE_SHARE_READ, nullptr, OPEN_EXISTING,
    FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OPEN_REPARSE_POINT, nullptr
  );
  if (handle == INVALID_HANDLE_VALUE) return fail(operation, GetLastError());

  DWORD error = ERROR_SUCCESS;
  if (!regularNonReparse(handle, &error)) {
    CloseHandle(handle);
    return fail(operation, error);
  }

  std::vector<BYTE> userStorage;
  PSID userSid = nullptr;
  BYTE systemStorage[SECURITY_MAX_SID_SIZE]{};
  BYTE administratorsStorage[SECURITY_MAX_SID_SIZE]{};
  PSID systemSid = nullptr;
  PSID administratorsSid = nullptr;
  if (!currentUserSid(&userStorage, &userSid, &error) ||
      !wellKnownSid(WinLocalSystemSid, systemStorage, sizeof(systemStorage),
                    &systemSid, &error) ||
      !wellKnownSid(WinBuiltinAdministratorsSid, administratorsStorage,
                    sizeof(administratorsStorage), &administratorsSid, &error)) {
    CloseHandle(handle);
    return fail(operation, error);
  }

  PSID owner = nullptr;
  PACL dacl = nullptr;
  PSECURITY_DESCRIPTOR descriptor = nullptr;
  const DWORD securityResult = GetSecurityInfo(
    handle, SE_FILE_OBJECT, OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
    &owner, nullptr, &dacl, nullptr, &descriptor
  );
  if (securityResult != ERROR_SUCCESS) {
    CloseHandle(handle);
    return fail(operation, securityResult);
  }

  SECURITY_DESCRIPTOR_CONTROL control = 0;
  DWORD revision = 0;
  if (owner == nullptr || !IsValidSid(owner) || !EqualSid(owner, userSid) ||
      dacl == nullptr || !IsValidAcl(dacl) || dacl->AceCount == 0 ||
      !GetSecurityDescriptorControl(descriptor, &control, &revision) ||
      (control & SE_DACL_PROTECTED) == 0) {
    LocalFree(descriptor);
    CloseHandle(handle);
    return fail(operation, ERROR_INVALID_SECURITY_DESCR);
  }

  for (DWORD index = 0; index < dacl->AceCount; ++index) {
    void* rawAce = nullptr;
    if (!GetAce(dacl, index, &rawAce) || rawAce == nullptr) {
      LocalFree(descriptor);
      CloseHandle(handle);
      return fail(operation, ERROR_INVALID_ACL);
    }
    const ACE_HEADER* header = static_cast<const ACE_HEADER*>(rawAce);
    if ((header->AceFlags & INHERIT_ONLY_ACE) != 0) {
      LocalFree(descriptor);
      CloseHandle(handle);
      return fail(operation, ERROR_INVALID_ACL);
    }
    if (header->AceType == ACCESS_ALLOWED_ACE_TYPE) {
      const ACCESS_ALLOWED_ACE* ace =
        static_cast<const ACCESS_ALLOWED_ACE*>(rawAce);
      PSID sid = const_cast<DWORD*>(&ace->SidStart);
      if (!IsValidSid(sid) ||
          (!EqualSid(sid, userSid) && !EqualSid(sid, systemSid) &&
           !EqualSid(sid, administratorsSid))) {
        LocalFree(descriptor);
        CloseHandle(handle);
        return fail(operation, ERROR_ACCESS_DENIED);
      }
    } else if (header->AceType == ACCESS_DENIED_ACE_TYPE) {
      const ACCESS_DENIED_ACE* ace =
        static_cast<const ACCESS_DENIED_ACE*>(rawAce);
      if (!IsValidSid(const_cast<DWORD*>(&ace->SidStart))) {
        LocalFree(descriptor);
        CloseHandle(handle);
        return fail(operation, ERROR_INVALID_ACL);
      }
    } else {
      LocalFree(descriptor);
      CloseHandle(handle);
      return fail(operation, ERROR_INVALID_ACL);
    }
  }

  BY_HANDLE_FILE_INFORMATION info{};
  if (!GetFileInformationByHandle(handle, &info)) {
    error = GetLastError();
    LocalFree(descriptor);
    CloseHandle(handle);
    return fail(operation, error);
  }
  const DWORD aceCount = dacl->AceCount;
  LocalFree(descriptor);
  CloseHandle(handle);

  const unsigned long long fileIndex =
    (static_cast<unsigned long long>(info.nFileIndexHigh) << 32) |
    static_cast<unsigned long long>(info.nFileIndexLow);
  std::cout << "{\"schema\":\"sdo.windows_private_key_acl_helper.v1\","
               "\"decision\":\"CONFIRMED\",\"operation\":";
  printJsonString(operation);
  std::cout << ",\"primitive\":\"" << primitive << "\","
               "\"ownerPolicy\":\"CURRENT_PROCESS_USER\","
               "\"daclPolicy\":\"PROTECTED_AUTHORIZED_PRINCIPALS_ONLY\","
               "\"authorizedPrincipalClasses\":[\"BUILTIN_ADMINISTRATORS\","
               "\"CURRENT_PROCESS_USER\",\"LOCAL_SYSTEM\"],"
               "\"aceCount\":" << aceCount << ","
               "\"volumeSerialNumber\":" << info.dwVolumeSerialNumber << ","
               "\"fileIndex\":\"" << fileIndex << "\",\"subject\":";
  printJsonString(subject);
  std::cout << "}" << std::endl;
  return 0;
}

int protectPrivateKeyAcl(const std::wstring& subject) {
  const wchar_t* operation = L"PROTECT_PRIVATE_KEY_ACL";
  HANDLE handle = CreateFileW(
    subject.c_str(), READ_CONTROL | WRITE_DAC,
    0, nullptr, OPEN_EXISTING,
    FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OPEN_REPARSE_POINT, nullptr
  );
  if (handle == INVALID_HANDLE_VALUE) return fail(operation, GetLastError());

  DWORD error = ERROR_SUCCESS;
  std::vector<BYTE> userStorage;
  PSID userSid = nullptr;
  BYTE systemStorage[SECURITY_MAX_SID_SIZE]{};
  BYTE administratorsStorage[SECURITY_MAX_SID_SIZE]{};
  PSID systemSid = nullptr;
  PSID administratorsSid = nullptr;
  if (!regularNonReparse(handle, &error) ||
      !currentUserSid(&userStorage, &userSid, &error) ||
      !wellKnownSid(WinLocalSystemSid, systemStorage, sizeof(systemStorage),
                    &systemSid, &error) ||
      !wellKnownSid(WinBuiltinAdministratorsSid, administratorsStorage,
                    sizeof(administratorsStorage), &administratorsSid, &error) ||
      !ownerIsCurrentUser(handle, userSid, &error) ||
      !applyPrivateKeyAcl(handle, userSid, systemSid, administratorsSid, &error)) {
    CloseHandle(handle);
    return fail(operation, error);
  }
  CloseHandle(handle);
  return verifyPrivateKeyAcl(
    subject, operation, "CreateFileW+SetSecurityInfo+GetSecurityInfo"
  );
}

}  // namespace

int wmain(int argc, wchar_t* argv[]) {
  if (argc != 3) return fail(L"INVALID_ARGUMENTS", ERROR_INVALID_PARAMETER);

  const std::wstring operation(argv[1]);
  const std::wstring subject(argv[2]);

  if (operation == L"flush-directory") {
    return flushDirectory(subject);
  }
  if (operation == L"protect-private-key-acl") {
    return protectPrivateKeyAcl(subject);
  }
  if (operation == L"verify-private-key-acl") {
    return verifyPrivateKeyAcl(
      subject, L"VERIFY_PRIVATE_KEY_ACL", "CreateFileW+GetSecurityInfo"
    );
  }

  return fail(L"UNSUPPORTED_OPERATION", ERROR_NOT_SUPPORTED);
}
