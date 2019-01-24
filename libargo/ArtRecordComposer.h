#ifndef ArtRecordComposer_H
#define ArtRecordComposer_H



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



class ArtRecordComposer {
public:
  ArtRecordComposer(JsonObject& output, TTree* tree, Long64_t jentry, const std::string options);
  ~ArtRecordComposer();
  void compose();
  void  composeHeaderData();

  // Reco
  void  composeHits();
  void  composeClusters();
  void  composeVertex2d();
  void  composeSpacepoints();
  void  composeTracks();
  void  composeShowers();
  void  composePFParticles();

  // Optical
  void  composeOpFlashes();
  void  composeOpHits();
  void  composeOpPulses();

  // Wires
  void  composeCalAvailability(); 
  void  composeRawAvailability(); 
  void  composeCal();
  void  composeRaw();

  // Other
  void composeAuxDets();

  
  // Monte carlo
  void  composeMC();

  // Assns.
  void  composeAssociations();

  // Utility functions.
  std::vector<std::string> findLeafOfType(std::string pattern);
  
  std::string stripdots(const std::string& s);
  JsonObject  GetClusterWireAndTDC(TreeElementLooter& l, int row);
  int         pointOffLine(const TLorentzVector& x0, const TLorentzVector& pv, const TLorentzVector& x, double tol);
  
  

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


