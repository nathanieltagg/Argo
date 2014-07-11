#include "WirePalette.h"

// Create the singleton at program start. (Before forking!)
// WirePalette::gWirePalette = new WirePalette;

WirePalette::WirePalette()
  :  fLookupTanscaleShort(8192)
{
  // Construct color map.
  
  unsigned char vv[] =   { 
    #include "palette.inc" 
  };
  fPalette.assign(&vv[0], &vv[0]+sizeof(vv));
  unsigned char vvt[] =   { 
    #include "palette_trans.inc" 
  };
  fPaletteTrans.assign(&vvt[0], &vvt[0]+sizeof(vvt));
  
  
  // Construct lookup tables  
  
  // map all values of a short from -0xfff to 0xfff into the lookup table.
  for(short in = -4096; in < 4097; in++) {
    int index = in+4096;
    fLookupTanscaleShort[index] = map_tanscale((float)in);
  }
  
}