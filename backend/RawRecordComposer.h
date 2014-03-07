#ifndef RawRecordComposer_H
#define RawRecordComposer_H



#include "JsonElement.h"
#include "online_monitor/Plexus.h"

#include <math.h>

namespace gov {namespace fnal {namespace uboone {namespace datatypes {
        class eventRecord;
        class channelData;
        class cardHeader;
        class cardData;
        class crateHeader;
        class crateData;
}}}}

class RawRecordComposer {
public:
  RawRecordComposer(JsonObject& output, std::shared_ptr<gov::fnal::uboone::datatypes::eventRecord> record, const std::string options);
  ~RawRecordComposer();

  void compose();
  void composeHeader();
  void composeTPC();
  void composePMTs();

  JsonObject& fOutput; // Top-level output object
  std::string fOptions;
  std::shared_ptr<gov::fnal::uboone::datatypes::eventRecord> fRecord;
  
  
  
  
  gov::fnal::uboone::online::Plexus fPlexus;
  
  static std::string sfFileStoragePath;
  static std::string sfUrlToFileStorage;
  
  std::vector<unsigned char> fPalette;
  std::vector<unsigned char> fPaletteTrans;
  
  // State things:
  int fmintdc;
  int fmaxtdc;
  
  
  int inline static tanscale(float adc) 
  {
    return int(atan(adc/25.)/M_PI*256.) + 127;  
  }

  float inline static inv_tanscale(int y) 
  {
    return tan((y-127)*M_PI/256)*25.;
  }
  
};



#endif 


