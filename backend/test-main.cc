#include <stdlib.h>
#include <stdio.h>
#include <iostream>

#include <TROOT.h>
#include <TRint.h>
#include <TStyle.h>
#include "MakePng.h"
#include <math.h>

using std::vector;
using std::cout;
using std::endl;

void hsvToRgb(unsigned char* out, float h, float s, float v){
    float r, g, b;

    int i = floor(h * 6);
    float f = h * 6 - i;
    float p = v * (1 - s);            // 0
    float q = v * (1 - f * s);        // 1-f
    float t = v * (1 - (1 - f) * s);  // f

    switch(i % 6){
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    
    // cout << (int)(r*255) << "\t"
    //     << (int)(g*255) << "\t"
    //     << (int)(b*255) << "\n";
    // return rgbToHsv(int(r*255),int(g*255),int(b*255));
    // return [r * 255, g * 255, b * 255];
    *(out   ) = (unsigned int)(r*255);
    *(out+1 ) = (unsigned int)(g*255);
    *(out+2 ) = (unsigned int)(b*255);
}


int main(int argc, char **argv)
{
  cout << "<html><head></head><body><img alt='Embedded Image' src='" << endl;
  // Test PNG:
  {
    MakePng png(100,100,MakePng::rgb);
    vector<unsigned char> v(100*3);
    for(int j=0;j<100;j++){
      for(int i=0;i<100;i++) {
        // float x = (i*j)*4000/10000.-2000;
        // int   xx = (int) x + 2000;
        // // std::cout << (xx>>8) << std:: endl;        
        // v[i*3]     = xx&0x0F;
        // v[i*3 + 1] = xx>>4;
        // v[i*3 + 2] = xx&0x0F;
        float adc = (i*j)*5000./10000.-2500;
        float h = adc/5000.+0.5;
        hsvToRgb(&v[i*3],h,1,1);
      }
      png.AddRow(v);
    }
    png.Finish();
    // std::cout << "Total png bytes:" << png.getDataLen() << std::endl;
    std::cout << png.getBase64Encoded() << std::endl;
    png.writeToFile("my.png");
  }
  cout << "'/></body></html>" << endl;;
  return(0);
};

