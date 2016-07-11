#ifndef LARLITERECORDCOMPOSER_H
#define LARLITERECORDCOMPOSER_H
#ifdef LARLITE


#include "JsonElement.h"
#include "TreeReader.h"
#include "TObject.h"
#include <math.h>
#include <vector>
#include <memory>
#include "boost/thread/mutex.hpp"

#include "DataFormat/storage_manager.h"



class LarliteRecordComposer {
public:
  LarliteRecordComposer(JsonObject& output, const std::string& filename, Long64_t jentry, const std::string options);
  ~LarliteRecordComposer();

  void compose();
  void compose_header();
  void compose_hits();
  void compose_tracks();
  void compose_associations();
  
  

  JsonObject& fOutput; // Top-level output object
  JsonObject fStats; // Processing metadata
  std::string fFilename;
  Long64_t fEntry;
  std::string fOptions;
  
  larlite::storage_manager fStorage_manager;
  
  bool fCreateSubdirCache;  
  std::string fCacheStoragePath;
  std::string fCacheStorageUrl;
  std::string fWorkingSuffix;
  std::string fFinalSuffix;
  
  std::string fCurrentEventDirname;
  std::string fCurrentEventUrl;
  
  boost::mutex fOutputMutex;
};


#endif
#endif 


