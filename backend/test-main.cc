#include <stdlib.h>
#include <stdio.h>
#include <iostream>

#include <TROOT.h>
#include <TRint.h>
#include <TStyle.h>
#include "MakePng.h"

using std::vector;
using std::cout;
using std::endl;

int main(int argc, char **argv)
{
  cout << "<html><head></head><body><img alt='Embedded Image' src='" << endl;
  // Test PNG:
  {
    MakePng png(100,100,16);
    vector<float> v(100);
    for(int j=0;j<100;j++){
      for(int i=0;i<100;i++) {
        v[i] = (float)(i*j)/10000.;
      }
      png.AddRow(v);
    }
    png.Finish();
    // std::cout << "Total png bytes:" << png.getDataLen() << std::endl;
    std::cout << png.getBase64Encoded() << std::endl;
    // png.writeToFile("my.png");
  }
  cout << "'/></body></html>" << endl;;
  return(0);
};

