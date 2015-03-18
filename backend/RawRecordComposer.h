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


  void getPmtFromCrateCardChan(int icrate, int icard,int ichan, int& outPmt, int& outGain,  std::string& outSpecial);
  JsonObject& fOutput; // Top-level output object
  std::string fOptions;
  std::shared_ptr<gov::fnal::uboone::datatypes::eventRecord> fRecord;
  
  // Configuration:
  std::string fCacheStoragePath;
  std::string fCacheStorageUrl;

  std::string fCurrentEventDirname;
  std::string fCurrentEventUrl;
  
    
  // State things:
  int fmintdc;
  int fmaxtdc;
  
  
  
};

extern gov::fnal::uboone::online::Plexus gPlexus;




#endif 


