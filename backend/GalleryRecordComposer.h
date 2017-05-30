#ifndef GalleryRecordComposer_H
#define GalleryRecordComposer_H



#include "JsonElement.h"
#include "TreeReader.h"
#include "TObject.h"
#include <math.h>
#include <vector>
#include <memory>
#include "boost/thread/mutex.hpp"


class TTree;
class TLorentzVector;
namespace gallery{ class Event; }


class GalleryRecordComposer {
public:
  GalleryRecordComposer(JsonObject& output, std::string filename, Long64_t jentry, const std::string options);
  ~GalleryRecordComposer();

  template<typename V>
    void composeObjectsVector(const std::string& output_name);
  template<typename T>
    void composeObject(const T&, JsonObject& out);
  
  void compose();
  void  composeHeaderData();
  //

  
  // // Reco
  void  composeHits();
  // void  composeClusters();
  // void  composeEndpoint2d();
  // void  composeSpacepoints();
  // void  composeTracks();
  // void  composeShowers();
  // void  composePFParticles();
  //
  // // Optical
  // void  composeOpFlashes();
  // void  composeOpHits();
  // void  composeOpPulses();
  //
  // // Wires
  void  composeCalAvailability();
  void  composeWires();
  void  composeRawAvailability();
  void  composeRaw();
  //
  // // Other
  // void composeAuxDets();
  //
  //
  // // Monte carlo
  // void  composeMC();
  //
  // // Assns.
  void  composeAssociations();
  
  template<typename A, typename B>
  void  composeAssociation(std::map<std::string, JsonObject>& assn_list);

  // // Utility functions.
  // std::vector<std::string> findLeafOfType(std::string pattern);
  //
  std::string stripdots(const std::string& s);
  // JsonObject  GetClusterWireAndTDC(TreeElementLooter& l, int row);
  // int         pointOffLine(const TLorentzVector& x0, const TLorentzVector& pv, const TLorentzVector& x, double tol);
  

  JsonObject& fOutput; // Top-level output object
  JsonObject fStats; // Processing metadata
  Long64_t fEntry;
  std::string fOptions;
  
  std::unique_ptr<gallery::Event> fEvent;
  
  bool fCreateSubdirCache;  
  std::string fCacheStoragePath;
  std::string fCacheStorageUrl;
  std::string fWorkingSuffix;
  std::string fFinalSuffix;
  
  std::string fCurrentEventDirname;
  std::string fCurrentEventUrl;

  double event_time;
  
  boost::mutex fOutputMutex;
  boost::mutex fGalleryLock;
  
};



#endif 


