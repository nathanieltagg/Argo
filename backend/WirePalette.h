#ifndef WIREPALETTE_H_1F8C84D8
#define WIREPALETTE_H_1F8C84D8

#include <vector>
#include <math.h>

// Mapping from any adc value onto an 8-bit integer for crude color purposes.


class WirePalette;

class WirePalette
{
public:
  static WirePalette* gWirePalette;

  inline int tanscale(short adc) { return fLookupTanscaleShort[(adc+4096)];};
    
  std::vector<unsigned char> fPalette;
  std::vector<unsigned char> fPaletteTrans;

  WirePalette();

private:
  std::vector<int> fLookupTanscaleShort;
  
  int inline static map_tanscale(float adc) 
  {
    return int(atan(adc/50.)/M_PI*256.) + 127;  
  }


  // inverse function.
  float inline static inv_tanscale(int y) 
  {
    return tan((y-127)*M_PI/256)*50.;
  }
  
};



#endif /* end of include guard: WIREPALETTE_H_1F8C84D8 */

