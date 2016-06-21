#ifndef LARLITERECORDCOMPOSER_H
#define LARLITERECORDCOMPOSER_H



#include "JsonElement.h"
#include "TreeReader.h"
#include "TObject.h"
#include <math.h>
#include <vector>
#include <memory>
#include "boost/thread/mutex.hpp"

class TFile;
class TreeElementLooter;



class LarliteRecordComposer {
public:
  LarliteRecordComposer(JsonObject& output, TFile* file, Long64_t jentry, const std::string options);
  ~LarliteRecordComposer();

  void compose();
  
  

  JsonObject& fOutput; // Top-level output object
  JsonObject fStats; // Processing metadata
  TFile* fFile;
  Long64_t fEntry;
  std::string fOptions;
  
  bool fCreateSubdirCache;  
  std::string fCacheStoragePath;
  std::string fCacheStorageUrl;
  std::string fWorkingSuffix;
  std::string fFinalSuffix;
  
  std::string fCurrentEventDirname;
  std::string fCurrentEventUrl;
};



#endif 


