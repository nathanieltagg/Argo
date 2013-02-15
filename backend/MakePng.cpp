#include <png.h>
#include "MakePng.h"
#include <cassert>
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <sys/types.h>
#include <sys/stat.h>

#include <TString.h>
#include "cencode.h"
#include <iostream>

using std::vector;
using std::string;
 
// custom write callback.
void my_user_write_data(
    png_structp png_ptr,
    png_bytep   data, 
    png_size_t  length)
{
  MakePng* self = (MakePng*)(png_get_io_ptr(png_ptr));
  self->AddData(png_ptr,data,length);
}
 
 
 
  
MakePng::MakePng(int width, int height, int depth, const std::string title)
  : width(width)
    , height(height)
    , depth(depth)
      , outdata(NULL)
        , outdatalen(0)
{
  fp=NULL;
  // Only for writing to file:
  // fp = fopen("my.png", "wb");
  // assert(fp);
  png_ptr = NULL;
  info_ptr = NULL;


  /* Initialize the write struct. */
  png_ptr = png_create_write_struct(PNG_LIBPNG_VER_STRING, NULL, NULL, NULL);
  assert(png_ptr);

  /* Initialize the info struct. */
  info_ptr = png_create_info_struct(png_ptr);
  assert(info_ptr);

  /* Set up error handling. */
  if (setjmp(png_jmpbuf(png_ptr))) {
  	png_destroy_write_struct(&png_ptr, &info_ptr);
    assert(true);
  }

	// only for writing to file:
  // png_init_io(png_ptr, fp);
  png_set_write_fn(png_ptr, this, my_user_write_data, NULL);

  /* Set image attributes. */
  png_set_IHDR(png_ptr,
               info_ptr,
               width,
               height,
               depth,
               PNG_COLOR_TYPE_GRAY,
               PNG_INTERLACE_NONE,
               PNG_COMPRESSION_TYPE_DEFAULT,
               PNG_FILTER_TYPE_DEFAULT);

  // png_text title_text;
  // title_text.compression = PNG_TEXT_COMPRESSION_NONE;
  // title_text.key =  Form("title");
  // title_text.text = Form(title.c_str());
  // png_set_text(png_ptr, info_ptr, &title_text, 1);


  png_write_info(png_ptr, info_ptr);

  /* Initialize rows of PNG. */
  int bytes_per_pixel = depth/8;
  if(bytes_per_pixel<1) bytes_per_pixel=1;
  bytes_per_row = width * bytes_per_pixel * sizeof(png_byte); //
  // Allocate memory for one row (3 bytes per pixel - RGB)
  rowdata = (png_bytep) malloc(bytes_per_row);
  rows_done = 0;
}

void MakePng::AddRow(const vector<float>& floatrow)
{
  assert(rows_done++ < height);
  // copy data into 16-bit grayscale.
  uint16_t* row_as_short = (uint16_t*)(rowdata);
  for(int i=0;i<width;i++) {
    uint16_t word = (uint16_t)(floatrow[i]*65535);
    row_as_short[i] = (word >> 8) | (word << 8); // Magic byte swap.
  }
  png_write_row(png_ptr, rowdata);

}

void MakePng::Finish()
{
  png_write_end(png_ptr, NULL);
  if (fp != NULL) fclose(fp);  
  if (info_ptr != NULL) png_free_data(png_ptr, info_ptr, PNG_FREE_ALL, -1);
  if (png_ptr != NULL) png_destroy_write_struct(&png_ptr, (png_infopp)NULL);
  if (rowdata != NULL) free(rowdata);  
}


void MakePng::AddData(png_structp png_ptr, png_bytep data, png_size_t length)
{
  // Callback from library to store data.
  size_t nsize = outdatalen + length;
  if(outdata) outdata = (png_bytep) realloc(outdata,nsize);
  else        outdata = (png_bytep) malloc(nsize);

  assert(outdata);
  memcpy(outdata + outdatalen, data, length);
  outdatalen += length;
}

void MakePng::writeToFile(const std::string& filename)
{
  FILE* fp = fopen(filename.c_str(),"wb");
  fwrite(outdata,outdatalen,1,fp);
  fclose(fp);
}

std::string MakePng::writeToUniqueFile(const std::string& path)
{
  char* buffer = new char[path.length()+20];
  std::string tmplate= path + "/XXXXXXXX";
  strcpy(buffer,tmplate.c_str());
  int fp = mkstemp(buffer);
  if(fp<0) {
    std::cerr << "MakePng::Couldn't open unique temporary file!" << std::endl;
    return "error";
  }
  write(fp,outdata,outdatalen);
  // Make world-readable
  fchmod(fp, 0000644);
  close(fp);
  // Move the file to something more useful.
  std::string newname(buffer);
  newname+=".png";
  rename(buffer,newname.c_str());
  return newname.substr(path.length(),string::npos); // REturns basename only
}

std::string MakePng::getBase64Encoded()
{
  base64_encodestate state;
  base64_init_encodestate(&state);
  char* code_out = new char[2*outdatalen+1];
  int codelength =base64_encode_block((char*)outdata, outdatalen, code_out, &state);
  string r(code_out);
  codelength+= base64_encode_blockend(code_out,&state);
  // r+= code_out;
  delete [] code_out;
  return r;
}


MakePng::~MakePng()
{
  if(outdata) free(outdata); 
}