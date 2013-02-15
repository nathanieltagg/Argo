#ifndef MAKEPNG_H_NHQFGWDJ
#define MAKEPNG_H_NHQFGWDJ

#include <vector>
#include <string>
#include <png.h>

class MakePng
{
public:
  MakePng(int width, int height, int depth, const std::string title = "blah");
  void AddRow(const std::vector<float>& floatrow); // normalized
  void Finish();
  unsigned char* getData() { return (unsigned char*) outdata; };
  size_t         getDataLen() { return outdatalen; };
  void           writeToFile(const std::string& filename);
  std::string    writeToUniqueFile(const std::string& path);
  std::string    getBase64Encoded(); 
  ~MakePng();
  

private:
  void AddData(png_structp png_ptr, png_bytep   data, png_size_t  length);
  friend void my_user_write_data( png_structp png_ptr,  png_bytep   data,   png_size_t  length);
  int width;
  int height;
  int depth; // bit depth of one image channels. 1,2,4,8, or 16.
  FILE* fp;
  png_structp png_ptr;
  png_infop   info_ptr;
  size_t bytes_per_row;
  png_bytep rowdata;
  int rows_done;
  
  png_bytep   outdata;
  size_t  outdatalen;
  
};

#endif /* end of include guard: MAKEPNG_H_NHQFGWDJ */
