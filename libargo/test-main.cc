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

///
/// A bunch of work trying to get a nice false-color scale.
///
/// uses http://www.tinaja.com/glib/falseclr.pdf for inspiration if not outright theft.


vector<float> return3vector(float a, float b, float c) {
  vector<float> v(3);
  v[0]=a; v[1]=b; v[2]=c;
  return v;
}

class LookupTable 
{
public:
  LookupTable();
  void hsl(float norm_x, float& h, float& s, float& l);
  vector< vector<float> >  table;
};

void LookupTable::hsl(float norm_x, float& h, float& s, float& l)
{
  norm_x = fmod(fmod(norm_x,1.0)+1.0,1.0);
  norm_x *= (table.size()-1);
  int outOfN = int(norm_x);
  // if(outOfN<0) outOfN = 0;
  // if(outOfN>=table.size()-2) outOfN = table.size()-2;
  vector<float>& row1 = table[outOfN];
  vector<float>& row2 = table[outOfN+1];
  float dx = norm_x - (float)outOfN;
  
  h = row1[0] + dx*(row2[0]-row1[0]);
  s = row1[1] + dx*(row2[1]-row1[1]);
  l = row1[2] + dx*(row2[2]-row1[2]);
  
  if(h<0) cout << "h<0  " << row1[0] << " " << row2[0] << " " << dx << endl;
}

LookupTable::LookupTable() {
  table.push_back(return3vector(0.000,0.710,1.0));
  table.push_back(return3vector(0.002,0.712,1.0));
  table.push_back(return3vector(0.006,0.715,1.0));
  table.push_back(return3vector(0.008,0.718,1.0));
  table.push_back(return3vector(0.012,0.721,1.0));
  table.push_back(return3vector(0.015,0.725,1.0));
  table.push_back(return3vector(0.018,0.727,1.0));
  table.push_back(return3vector(0.021,0.731,1.0));
  table.push_back(return3vector(0.024,0.733,1.0));
  table.push_back(return3vector(0.027,0.737,1.0));
  table.push_back(return3vector(0.030,0.739,1.0));
  table.push_back(return3vector(0.033,0.743,1.0));
  table.push_back(return3vector(0.036,0.745,1.0));
  table.push_back(return3vector(0.039,0.749,1.0));
  table.push_back(return3vector(0.042,0.751,1.0));
  table.push_back(return3vector(0.045,0.755,1.0));
  table.push_back(return3vector(0.048,0.757,1.0));
  table.push_back(return3vector(0.050,0.760,1.0));
  table.push_back(return3vector(0.054,0.763,1.0));
  table.push_back(return3vector(0.056,0.766,1.0));
  table.push_back(return3vector(0.060,0.769,1.0));
  table.push_back(return3vector(0.062,0.772,1.0));
  table.push_back(return3vector(0.066,0.775,1.0));
  table.push_back(return3vector(0.068,0.778,1.0));
  table.push_back(return3vector(0.072,0.781,1.0));
  table.push_back(return3vector(0.074,0.784,1.0));
  table.push_back(return3vector(0.078,0.787,1.0));
  table.push_back(return3vector(0.080,0.790,1.0));
  table.push_back(return3vector(0.084,0.793,1.0));
  table.push_back(return3vector(0.086,0.796,1.0));
  table.push_back(return3vector(0.090,0.799,1.0));
  table.push_back(return3vector(0.093,0.802,1.0));
  table.push_back(return3vector(0.096,0.805,1.0));
  table.push_back(return3vector(0.099,0.808,1.0));
  table.push_back(return3vector(0.102,0.811,1.0));
  table.push_back(return3vector(0.105,0.814,1.0));
  table.push_back(return3vector(0.107,0.816,1.0));
  table.push_back(return3vector(0.110,0.820,1.0));
  table.push_back(return3vector(0.112,0.821,1.0));
  table.push_back(return3vector(0.115,0.824,1.0));
  table.push_back(return3vector(0.116,0.825,1.0));
  table.push_back(return3vector(0.119,0.828,1.0));
  table.push_back(return3vector(0.119,0.828,1.0));
  table.push_back(return3vector(0.122,0.832,1.0));
  table.push_back(return3vector(0.122,0.831,1.0));
  table.push_back(return3vector(0.125,0.834,1.0));
  table.push_back(return3vector(0.124,0.833,1.0));
  table.push_back(return3vector(0.127,0.836,1.0));
  table.push_back(return3vector(0.125,0.834,1.0));
  table.push_back(return3vector(0.128,0.836,1.0));
  table.push_back(return3vector(0.124,0.836,1.0));
  table.push_back(return3vector(0.130,0.839,1.0));
  table.push_back(return3vector(0.128,0.837,1.0));
  table.push_back(return3vector(0.131,0.840,1.0));
  table.push_back(return3vector(0.129,0.838,1.0));
  table.push_back(return3vector(0.132,0.842,1.0));
  table.push_back(return3vector(0.131,0.840,1.0));
  table.push_back(return3vector(0.134,0.843,1.0));
  table.push_back(return3vector(0.133,0.842,1.0));
  table.push_back(return3vector(0.136,0.845,1.0));
  table.push_back(return3vector(0.135,0.845,1.0));
  table.push_back(return3vector(0.139,0.844,1.0));
  table.push_back(return3vector(0.138,0.847,1.0));
  table.push_back(return3vector(0.144,0.851,1.0));
  table.push_back(return3vector(0.141,0.851,1.0));
  table.push_back(return3vector(0.145,0.854,1.0));
  table.push_back(return3vector(0.145,0.854,1.0));
  table.push_back(return3vector(0.148,0.858,1.0));
  table.push_back(return3vector(0.149,0.858,1.0));
  table.push_back(return3vector(0.152,0.861,1.0));
  table.push_back(return3vector(0.154,0.862,1.0));
  table.push_back(return3vector(0.156,0.865,1.0));
  table.push_back(return3vector(0.157,0.866,1.0));
  table.push_back(return3vector(0.160,0.869,1.0));
  table.push_back(return3vector(0.161,0.870,1.0));
  table.push_back(return3vector(0.164,0.873,1.0));
  table.push_back(return3vector(0.165,0.874,1.0));
  table.push_back(return3vector(0.168,0.877,1.0));
  table.push_back(return3vector(0.169,0.878,1.0));
  table.push_back(return3vector(0.172,0.881,1.0));
  table.push_back(return3vector(0.173,0.882,1.0));
  table.push_back(return3vector(0.176,0.885,1.0));
  table.push_back(return3vector(0.177,0.886,1.0));
  table.push_back(return3vector(0.180,0.889,1.0));
  table.push_back(return3vector(0.181,0.890,1.0));
  table.push_back(return3vector(0.184,0.894,1.0));
  table.push_back(return3vector(0.185,0.894,1.0));
  table.push_back(return3vector(0.188,0.897,1.0));
  table.push_back(return3vector(0.189,0.898,1.0));
  table.push_back(return3vector(0.192,0.901,1.0));
  table.push_back(return3vector(0.193,0.902,1.0));
  table.push_back(return3vector(0.196,0.905,1.0));
  table.push_back(return3vector(0.197,0.906,1.0));
  table.push_back(return3vector(0.200,0.909,1.0));
  table.push_back(return3vector(0.201,0.910,1.0));
  table.push_back(return3vector(0.204,0.913,1.0));
  table.push_back(return3vector(0.206,0.915,1.0));
  table.push_back(return3vector(0.209,0.918,1.0));
  table.push_back(return3vector(0.214,0.923,1.0));
  table.push_back(return3vector(0.218,0.926,1.0));
  table.push_back(return3vector(0.225,0.995,1.0));
  table.push_back(return3vector(0.228,0.991,1.0));
  table.push_back(return3vector(0.238,0.983,1.0));
  table.push_back(return3vector(0.242,0.978,1.0));
  table.push_back(return3vector(0.254,0.965,1.0));
  table.push_back(return3vector(0.257,1.000,1.0));
  table.push_back(return3vector(0.271,1.000,1.0));
  table.push_back(return3vector(0.274,1.000,1.0));
  table.push_back(return3vector(0.289,0.928,1.0));
  table.push_back(return3vector(0.292,0.925,1.0));
  table.push_back(return3vector(0.307,0.909,1.0));
  table.push_back(return3vector(0.311,0.906,1.0));
  table.push_back(return3vector(0.324,0.891,1.0));
  table.push_back(return3vector(0.328,0.888,1.0));
  table.push_back(return3vector(0.340,0.875,1.0));
  table.push_back(return3vector(0.343,0.872,1.0));
  table.push_back(return3vector(0.353,0.860,1.0));
  table.push_back(return3vector(0.357,0.857,1.0));
  table.push_back(return3vector(0.366,0.846,1.0));
  table.push_back(return3vector(0.370,0.844,1.0));
  table.push_back(return3vector(0.378,0.836,1.0));
  table.push_back(return3vector(0.381,0.835,1.0));
  table.push_back(return3vector(0.389,0.824,1.0));
  table.push_back(return3vector(0.392,0.821,1.0));
  table.push_back(return3vector(0.398,0.814,1.0));
  table.push_back(return3vector(0.402,0.811,1.0));
  table.push_back(return3vector(0.402,0.805,1.0));
  table.push_back(return3vector(0.411,0.802,1.0));
  table.push_back(return3vector(0.416,0.796,1.0));
  table.push_back(return3vector(0.419,0.792,1.0));
  table.push_back(return3vector(0.424,0.787,1.0));
  table.push_back(return3vector(0.428,0.784,1.0));
  table.push_back(return3vector(0.433,0.778,1.0));
  table.push_back(return3vector(0.436,0.775,1.0));
  table.push_back(return3vector(0.441,0.770,1.0));
  table.push_back(return3vector(0.445,0.762,1.0));
  table.push_back(return3vector(0.450,0.761,1.0));
  table.push_back(return3vector(0.453,0.757,1.0));
  table.push_back(return3vector(0.458,0.757,1.0));
  table.push_back(return3vector(0.461,0.749,1.0));
  table.push_back(return3vector(0.466,0.743,1.0));
  table.push_back(return3vector(0.470,0.740,1.0));
  table.push_back(return3vector(0.475,0.734,1.0));
  table.push_back(return3vector(0.478,0.731,1.0));
  table.push_back(return3vector(0.484,0.725,1.0));
  table.push_back(return3vector(0.487,0.722,1.0));
  table.push_back(return3vector(0.492,0.717,1.0));
  table.push_back(return3vector(0.495,0.713,1.0));
  table.push_back(return3vector(0.501,0.708,1.0));
  table.push_back(return3vector(0.504,0.704,1.0));
  table.push_back(return3vector(0.509,0.699,1.0));
  table.push_back(return3vector(0.512,0.695,1.0));
  table.push_back(return3vector(0.518,0.693,1.0));
  table.push_back(return3vector(0.521,0.687,1.0));
  table.push_back(return3vector(0.526,0.681,1.0));
  table.push_back(return3vector(0.529,0.678,1.0));
  table.push_back(return3vector(0.534,0.673,1.0));
  table.push_back(return3vector(0.537,0.669,1.0));
  table.push_back(return3vector(0.542,0.665,1.0));
  table.push_back(return3vector(0.545,0.661,1.0));
  table.push_back(return3vector(0.549,0.657,1.0));
  table.push_back(return3vector(0.552,0.654,1.0));
  table.push_back(return3vector(0.556,0.650,1.0));
  table.push_back(return3vector(0.559,0.647,1.0));
  table.push_back(return3vector(0.562,0.643,1.0));
  table.push_back(return3vector(0.566,0.640,1.0));
  table.push_back(return3vector(0.569,0.637,1.0));
  table.push_back(return3vector(0.572,0.633,1.0));
  table.push_back(return3vector(0.574,0.631,1.0));
  table.push_back(return3vector(0.578,0.627,1.0));
  table.push_back(return3vector(0.580,0.625,1.0));
  table.push_back(return3vector(0.583,0.621,1.0));
  table.push_back(return3vector(0.586,0.619,1.0));
  table.push_back(return3vector(0.589,0.615,1.0));
  table.push_back(return3vector(0.592,0.612,1.0));
  table.push_back(return3vector(0.595,0.609,1.0));
  table.push_back(return3vector(0.597,0.607,1.0));
  table.push_back(return3vector(0.601,0.603,1.0));
  table.push_back(return3vector(0.603,0.601,1.0));
  table.push_back(return3vector(0.607,0.597,1.0));
  table.push_back(return3vector(0.609,0.595,1.0));
  table.push_back(return3vector(0.614,0.591,1.0));
  table.push_back(return3vector(0.615,0.589,1.0));
  table.push_back(return3vector(0.618,0.585,1.0));
  table.push_back(return3vector(0.621,0.583,1.0));
  table.push_back(return3vector(0.624,0.579,1.0));
  table.push_back(return3vector(0.626,0.577,1.0));
  table.push_back(return3vector(0.630,0.573,1.0));
  table.push_back(return3vector(0.632,0.575,1.0));
  table.push_back(return3vector(0.635,0.567,1.0));
  table.push_back(return3vector(0.638,0.565,1.0));
  table.push_back(return3vector(0.641,0.561,1.0));
  table.push_back(return3vector(0.644,0.559,1.0));
  table.push_back(return3vector(0.643,0.553,1.0));
  table.push_back(return3vector(0.649,0.553,1.0));
  table.push_back(return3vector(0.653,0.549,1.0));
  table.push_back(return3vector(0.655,0.547,1.0));
  table.push_back(return3vector(0.658,0.543,1.0));
  table.push_back(return3vector(0.661,0.541,1.0));
  table.push_back(return3vector(0.664,0.537,1.0));
  table.push_back(return3vector(0.667,0.535,1.0));
}


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


void hsvToRgbFloat(float& r, float& g, float& b, float h, float s, float v){

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
    r*=255;
    g*=255;
    b*=255;
}

int tanscale(float adc) 
{
  return int(atan(adc/50.)/M_PI*256.) + 127;  
}

float inv_tanscale(int y) 
{
  return tan((y-127)*M_PI/256)*50.;
}


int main(int argc, char **argv)
{


  /// lots and lots of playing around to try to find an ideal color map.
  
  // cout << "<html><head></head><body><img alt='Embedded Image' src='" << endl;
  // Test PNG:
  {
    // Create a custom palette.
    LookupTable t;
    
    std::vector<unsigned char> palette(256*3);
    for(int i=0;i<256;i++) 
    {
      // here, i represents the palette lookup code
      // Convert to a raw ADC value using the inverse lookup:
      float adc = inv_tanscale(i);
      float x = -atan(adc/300.)/3.70;//3.14159;
      x+=0.15;
      float h,s,v;
      float xx = fmod(fmod(x,1.0)+1.0,1.0);
      h = xx;
      s = 0.9;
      v = 1;
      // t.hsl(xx,h,s,v);
      if(fabs(adc)<30) {s *= (fabs(adc/30.));};
      // if(fabs(adc)>95 && fabs(adc)<100) {v=0;}
      if(fabs(adc)>1000) {v=0.8;}
      float r,g,b;
      hsvToRgbFloat(r,g,b,h,s,v);
      palette[i*3] = (int)r;
      palette[i*3+1] = (int)g;
      palette[i*3+2] = (int)b;
      cout  << int(r) << "," << int(g) << "," << int(b) << "," << " // " << i << endl;
    }
    
    // Test it against a wide range of ADC values.
    int width = 4000;
    MakePng png(width,10,MakePng::palette,palette);
    
    vector<unsigned char> vec(width);
    for(int j=0;j<10;j++){
      for(int i=0;i<width;i++) {
        float adc = (i-(float)width/2.)*8000./float(width);
        
        int val = tanscale(adc);
        vec[i] = val;
      }
      png.AddRow(vec);
    }
    png.Finish();
    // std::cout << "Total png bytes:" << png.getDataLen() << std::endl;
    // std::cout << png.getBase64Encoded() << std::endl;
    png.writeToFile("my.png");
  }
  // cout << "'/></body></html>" << endl;;
  return(0);
};

