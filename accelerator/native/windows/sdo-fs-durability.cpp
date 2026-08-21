#define UNICODE
#define _UNICODE
#include <windows.h>

#include <iostream>
#include <string>

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

}  // namespace

int wmain(int argc, wchar_t* argv[]) {
  if (argc != 3) return fail(L"INVALID_ARGUMENTS", ERROR_INVALID_PARAMETER);

  const std::wstring operation(argv[1]);
  const std::wstring subject(argv[2]);

  if (operation == L"flush-directory") {
    return flushDirectory(subject);
  }

  return fail(L"UNSUPPORTED_OPERATION", ERROR_NOT_SUPPORTED);
}
