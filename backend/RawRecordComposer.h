#ifndef RawRecordComposer_H
#define RawRecordComposer_H



#include "JsonElement.h"
#include "online_monitor/Plexus.h"
#include "datatypes/ub_EventRecord.h"

#include <math.h>


class RawRecordComposer {
public:
  RawRecordComposer(JsonObject& output, std::shared_ptr<gov::fnal::uboone::datatypes::ub_EventRecord> record, const std::string options);
  ~RawRecordComposer();

  void compose();
  void composeHeader();
  void composeTPC();
  void composePMTs();


  void getPmtFromCrateCardChan(int icrate, int icard,int ichan, int& outPmt, int& outGain,  std::string& outSpecial);
  JsonObject& fOutput; // Top-level output object
  std::string fOptions;
  std::shared_ptr<gov::fnal::uboone::datatypes::ub_EventRecord> fRecord;
  
  // Configuration:
  bool fCreateSubdirCache;
  std::string fCacheStoragePath;
  std::string fCacheStorageUrl;
  std::string fWorkingSuffix;
  std::string fFinalSuffix;
  
  std::string fCurrentEventDirname;
  std::string fCurrentEventUrl;
  
    
  // State things:
  int fmintdc;
  int fmaxtdc;
  
  JsonObject fStats; // Processing metadata
  
};

extern gov::fnal::uboone::online::Plexus gPlexus;




#endif 


