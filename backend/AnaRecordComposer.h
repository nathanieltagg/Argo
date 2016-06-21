#ifndef ANARECORDCOMPOSER_H
#define ANARECORDCOMPOSER_H



#include "JsonElement.h"
#include "TreeReader.h"
#include "TObject.h"
#include <math.h>
#include <vector>
#include <memory>
#include "boost/thread/mutex.hpp"

class TTree;
class TreeElementLooter;
class TLorentzVector;



class AnaRecordComposer {
public:
  AnaRecordComposer(JsonObject& output, TTree* tree, Long64_t jentry, const std::string options);
  ~AnaRecordComposer();

  void compose();
  
  void composeHeader();
  void composeHits();
  

  JsonObject& fOutput; // Top-level output object
  JsonObject fStats; // Processing metadata
  TTree* fTree;
  Long64_t fEntry;
  std::string fOptions;
  TreeReader ftr;
  
  bool fCreateSubdirCache;  
  std::string fCacheStoragePath;
  std::string fCacheStorageUrl;
  std::string fWorkingSuffix;
  std::string fFinalSuffix;
  
  std::string fCurrentEventDirname;
  std::string fCurrentEventUrl;

  double event_time;
  
  boost::mutex fOutputMutex;
  

  
};



#endif 


