#ifndef RECORDCOMPOSER_H
#define RECORDCOMPOSER_H



#include "JsonElement.h"
#include "TObject.h"
#include <math.h>
class TTree;
#include "eventRecord.h"

class RecordComposer {
public:
  RecordComposer(JsonObject& output, gov::fnal::uboone::datatypes::eventRecord& event , const std::string options);
  ~RecordComposer();
  void compose();
  void  composeHeaderData();

  // Wires
  void  composeRaw();
    
  // Mapping from any adc value onto an 8-bit integer for crude color purposes.
  
  int tanscale(float adc) 
  {
    return int(atan(adc/50.)/M_PI*256.) + 127;  
  }

  float inv_tanscale(int y) 
  {
    return tan((y-127)*M_PI/256)*50.;
  }
  
  
  JsonObject& fOutput; // Top-level output object
  gov::fnal::uboone::datatypes::eventRecord& fEvt;
  std::string fOptions;

  static std::string sfFileStoragePath;
  static std::string sfUrlToFileStorage;
  
  std::vector<unsigned char> fPalette;
  std::vector<unsigned char> fPaletteTrans;
};



#endif 


