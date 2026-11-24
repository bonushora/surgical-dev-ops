#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#include <windows.h>
#include <aclapi.h>
#include <sddl.h>

#include <iostream>
#include <string>
#include <vector>

namespace {

constexpr wchar_t KEY_NAME[] = L"private-key.pkcs8.pem";
constexpr size_t MAX_KEY_BYTES = 16384;

int fail(const char* code, DWORD error = 0) {
  std::cout << "{\"schema\":\"sdo.windows_private_key_acl.v1\","
               "\"decision\":\"FAILED\",\"code\":\"" << code
            << "\",\"win32Error\":" << error << "}\n";
  return 2;
}

std::string utf8(const std::wstring& value) {
  if (value.empty()) return {};
  const int size = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS,
    value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
  if (size <= 0) return {};
  std::string out(static_cast<size_t>(size), '\0');
  if (WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(),
        static_cast<int>(value.size()), out.data(), size, nullptr, nullptr) != size) return {};
  return out;
}

void printJsonString(const std::wstring& value) {
  const std::string encoded = utf8(value);
  const char* hex = "0123456789abcdef";
  std::cout << '"';
  for (unsigned char ch : encoded) {
    if (ch == '\\') std::cout << "\\\\";
    else if (ch == '"') std::cout << "\\\"";
    else if (ch == '\n') std::cout << "\\n";
    else if (ch == '\r') std::cout << "\\r";
    else if (ch == '\t') std::cout << "\\t";
    else if (ch < 0x20) std::cout << "\\u00" << hex[(ch >> 4) & 15] << hex[ch & 15];
    else std::cout << static_cast<char>(ch);
  }
  std::cout << '"';
}

bool processUser(std::vector<BYTE>& storage, PSID& user) {
  HANDLE token = nullptr;
  if (!OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &token)) return false;
  DWORD needed = 0;
  GetTokenInformation(token, TokenUser, nullptr, 0, &needed);
  if (GetLastError() != ERROR_INSUFFICIENT_BUFFER || needed == 0 || needed > 16384) {
    CloseHandle(token);
    return false;
  }
  storage.resize(needed);
  const BOOL ok = GetTokenInformation(token, TokenUser, storage.data(), needed, &needed);
  CloseHandle(token);
  if (!ok) return false;
  user = reinterpret_cast<TOKEN_USER*>(storage.data())->User.Sid;
  return IsValidSid(user) == TRUE;
}

bool allowedSid(PSID sid, PSID user) {
  BYTE systemBytes[SECURITY_MAX_SID_SIZE] = {};
  BYTE adminsBytes[SECURITY_MAX_SID_SIZE] = {};
  DWORD sysSize = sizeof(systemBytes), admSize = sizeof(adminsBytes);
  if (!CreateWellKnownSid(WinLocalSystemSid, nullptr, systemBytes, &sysSize) ||
      !CreateWellKnownSid(WinBuiltinAdministratorsSid, nullptr, adminsBytes, &admSize)) return false;
  return EqualSid(sid, user) || EqualSid(sid, systemBytes) || EqualSid(sid, adminsBytes);
}

bool validateAcl(HANDLE file, PSID user, BY_HANDLE_FILE_INFORMATION& info) {
  FILE_ATTRIBUTE_TAG_INFO attrs{};
  if (!GetFileInformationByHandleEx(file, FileAttributeTagInfo, &attrs, sizeof(attrs)) ||
      (attrs.FileAttributes & FILE_ATTRIBUTE_DIRECTORY) ||
      (attrs.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT)) return false;
  if (!GetFileInformationByHandle(file, &info)) return false;

  PSECURITY_DESCRIPTOR descriptor = nullptr;
  PSID owner = nullptr;
  PACL dacl = nullptr;
  const DWORD status = GetSecurityInfo(file, SE_FILE_OBJECT,
    OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
    &owner, nullptr, &dacl, nullptr, &descriptor);
  if (status != ERROR_SUCCESS || !descriptor) return false;
  SECURITY_DESCRIPTOR_CONTROL control{};
  DWORD revision = 0;
  ACL_SIZE_INFORMATION aclInfo{};
  bool safe = owner && IsValidSid(owner) && EqualSid(owner, user) &&
      dacl && GetSecurityDescriptorControl(descriptor, &control, &revision) &&
      (control & SE_DACL_PROTECTED) && IsValidAcl(dacl) &&
      GetAclInformation(dacl, &aclInfo, sizeof(aclInfo), AclSizeInformation) &&
      aclInfo.AceCount > 0 && aclInfo.AceCount <= 4;
  bool currentUserRead = false;
  if (safe) {
    for (DWORD i = 0; i < aclInfo.AceCount; ++i) {
      LPVOID ace = nullptr;
      if (!GetAce(dacl, i, &ace) || !ace) { safe = false; break; }
      const ACE_HEADER* header = static_cast<ACE_HEADER*>(ace);
      if (header->AceType != ACCESS_ALLOWED_ACE_TYPE ||
          (header->AceFlags & INHERITED_ACE) != 0 ||
          header->AceSize < sizeof(ACCESS_ALLOWED_ACE)) {
        safe = false;
        break;
      }
      const ACCESS_ALLOWED_ACE* allowed = static_cast<ACCESS_ALLOWED_ACE*>(ace);
      PSID sid = const_cast<DWORD*>(&allowed->SidStart);
      if (!IsValidSid(sid) || !allowedSid(sid, user)) { safe = false; break; }
      if (EqualSid(sid, user) && (allowed->Mask & FILE_READ_DATA) != 0)
        currentUserRead = true;
    }
  }
  LocalFree(descriptor);
  return safe && currentUserRead;
}

void success(const char* operation, const std::wstring& path,
             const BY_HANDLE_FILE_INFORMATION& info,
             const char* primitive = "CreateFileW+GetSecurityInfo+DaclTrusteeReview") {
  const unsigned long long index =
    (static_cast<unsigned long long>(info.nFileIndexHigh) << 32) |
    static_cast<unsigned long long>(info.nFileIndexLow);
  std::cout << "{\"schema\":\"sdo.windows_private_key_acl.v1\","
               "\"decision\":\"CONFIRMED\",\"operation\":\"" << operation
            << "\",\"primitive\":\"" << primitive << "\","
               "\"ownerMatchesToken\":true,\"daclProtected\":true,"
               "\"noBroadAllowAces\":true,\"userReadAllowed\":true,"
               "\"volumeSerialNumber\":" << info.dwVolumeSerialNumber
            << ",\"fileIndex\":\"" << index << "\",\"subject\":";
  printJsonString(path);
  std::cout << "}\n";
}

bool parentIsSafe(const std::wstring& file) {
  const size_t slash = file.find_last_of(L"\\/");
  if (slash == std::wstring::npos || slash == 0 ||
      file.substr(slash + 1) != KEY_NAME) return false;
  const std::wstring parent = file.substr(0, slash);
  HANDLE handle = CreateFileW(parent.c_str(), FILE_READ_ATTRIBUTES,
    FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
    nullptr, OPEN_EXISTING,
    FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
  if (handle == INVALID_HANDLE_VALUE) return false;
  FILE_ATTRIBUTE_TAG_INFO attrs{};
  const BOOL ok = GetFileInformationByHandleEx(handle, FileAttributeTagInfo, &attrs, sizeof(attrs));
  CloseHandle(handle);
  return ok && (attrs.FileAttributes & FILE_ATTRIBUTE_DIRECTORY) &&
    !(attrs.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT);
}

int verifyKey(const std::wstring& file) {
  if (!parentIsSafe(file)) return fail("UNSAFE_PARENT");
  HANDLE h = CreateFileW(file.c_str(), READ_CONTROL | FILE_READ_ATTRIBUTES,
    FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
    nullptr, OPEN_EXISTING, FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
  if (h == INVALID_HANDLE_VALUE) return fail("OPEN_FAILED", GetLastError());
  std::vector<BYTE> tokenBytes;
  PSID user = nullptr;
  BY_HANDLE_FILE_INFORMATION info{};
  const bool ok = processUser(tokenBytes, user) && validateAcl(h, user, info);
  CloseHandle(h);
  if (!ok) return fail("ACL_NOT_PROVEN");
  success("VERIFY_PRIVATE_KEY_ACL", file, info);
  return 0;
}


// Validate the *inherited file object*, not a second path-based open.
// The parent keeps this same descriptor open for the subsequent key read.
bool handlePathMatches(HANDLE handle, const std::wstring& expected) {
  constexpr DWORD flags = FILE_NAME_NORMALIZED | VOLUME_NAME_DOS;
  const DWORD required = GetFinalPathNameByHandleW(handle, nullptr, 0, flags);
  if (required == 0 || required > 32767) return false;
  std::wstring resolved(static_cast<size_t>(required) + 1, L'\0');
  const DWORD n = GetFinalPathNameByHandleW(
    handle, &resolved[0], static_cast<DWORD>(resolved.size()), flags
  );
  if (n == 0 || n > required) return false;
  resolved.resize(n);
  // Windows normally prefixes an absolute local file path with \\?\.
  constexpr wchar_t prefix[] = L"\\\\?\\";
  if (resolved.compare(0, 4, prefix) == 0) resolved.erase(0, 4);
  return CompareStringOrdinal(resolved.c_str(), -1, expected.c_str(), -1, TRUE) == CSTR_EQUAL;
}

int verifyInheritedKeyHandle(const std::wstring& file) {
  if (!parentIsSafe(file)) return fail("UNSAFE_PARENT");
  HANDLE inherited = GetStdHandle(STD_INPUT_HANDLE);
  if (inherited == nullptr || inherited == INVALID_HANDLE_VALUE ||
      GetFileType(inherited) != FILE_TYPE_DISK) {
    return fail("INVALID_INHERITED_HANDLE");
  }
  if (!handlePathMatches(inherited, file)) return fail("HANDLE_PATH_MISMATCH");
  std::vector<BYTE> tokenBytes;
  PSID user = nullptr;
  BY_HANDLE_FILE_INFORMATION info{};
  if (!processUser(tokenBytes, user) || !validateAcl(inherited, user, info)) {
    return fail("ACL_NOT_PROVEN");
  }
  success("VERIFY_PRIVATE_KEY_HANDLE_ACL", file, info,
          "InheritedHandle+GetSecurityInfo+DaclTrusteeReview");
  return 0;
}

int createKey(const std::wstring& file) {
  if (!parentIsSafe(file)) return fail("UNSAFE_PARENT");
  std::vector<BYTE> tokenBytes;
  PSID user = nullptr;
  if (!processUser(tokenBytes, user)) return fail("USER_TOKEN_UNAVAILABLE");
  LPWSTR sidText = nullptr;
  if (!ConvertSidToStringSidW(user, &sidText)) return fail("SID_FORMAT_FAILED", GetLastError());
  const std::wstring sddl = L"O:" + std::wstring(sidText) +
    L"D:P(A;;FA;;;SY)(A;;FA;;;BA)(A;;FA;;;" + std::wstring(sidText) + L")";
  LocalFree(sidText);
  PSECURITY_DESCRIPTOR descriptor = nullptr;
  if (!ConvertStringSecurityDescriptorToSecurityDescriptorW(
      sddl.c_str(), SDDL_REVISION_1, &descriptor, nullptr)) return fail("SDDL_INVALID", GetLastError());
  SECURITY_ATTRIBUTES security{sizeof(security), descriptor, FALSE};
  HANDLE h = CreateFileW(file.c_str(), GENERIC_READ | GENERIC_WRITE | READ_CONTROL,
    FILE_SHARE_READ, &security, CREATE_NEW,
    FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
  LocalFree(descriptor);
  if (h == INVALID_HANDLE_VALUE) return fail("EXCLUSIVE_CREATE_FAILED", GetLastError());
  std::vector<BYTE> bytes(MAX_KEY_BYTES + 1);
  size_t total = 0;
  bool streamOk = true;
  for (;;) {
    DWORD read = 0;
    const BOOL got = ReadFile(GetStdHandle(STD_INPUT_HANDLE),
      bytes.data() + total, static_cast<DWORD>(bytes.size() - total), &read, nullptr);
    if (!got) {
      if (GetLastError() != ERROR_BROKEN_PIPE) streamOk = false;
      break;
    }
    if (read == 0) break;
    total += read;
    if (total > MAX_KEY_BYTES) { streamOk = false; break; }
  }
  bool written = false;
  if (streamOk && total >= 32 && total <= MAX_KEY_BYTES) {
    DWORD count = 0;
    written = WriteFile(h, bytes.data(), static_cast<DWORD>(total), &count, nullptr) &&
              count == total && FlushFileBuffers(h);
  }
  SecureZeroMemory(bytes.data(), bytes.size());
  BY_HANDLE_FILE_INFORMATION info{};
  const bool safe = written && validateAcl(h, user, info);
  CloseHandle(h);
  if (!safe) {
    DeleteFileW(file.c_str());
    return fail("PRIVATE_KEY_CREATION_NOT_ATTESTED");
  }
  success("CREATE_PRIVATE_KEY_ACL", file, info);
  return 0;
}

}  // namespace

int wmain(int argc, wchar_t* argv[]) {
  if (argc != 3) return fail("INVALID_ARGUMENTS");
  const std::wstring op(argv[1]), file(argv[2]);
  if (file.empty() || file.find(L":") != 1 || file.size() < 5)
    return fail("NONCANONICAL_KEY_PATH");
  if (op == L"verify-private-key") return verifyKey(file);
  if (op == L"verify-private-key-handle") return verifyInheritedKeyHandle(file);
  if (op == L"create-private-key") return createKey(file);
  return fail("UNSUPPORTED_OPERATION");
}
