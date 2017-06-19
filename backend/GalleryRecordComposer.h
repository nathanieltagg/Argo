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
struct GalleryAssociationHelper;
namespace art{ class InputTag; }

class GalleryRecordComposer {
public:
  GalleryRecordComposer(JsonObject& output, std::string filename, Long64_t jentry, const std::string options);
  ~GalleryRecordComposer();

  template<typename V>
    bool composeObjectsVector(const std::string& output_name, JsonObject& output);
  template<typename T>
    void composeObject(const T&, JsonObject& out);
  
  void compose();
  void  composeHeaderData();
  //

  
  // Reco
  void  composeHits();
  
  // Wires
  void  composeCalAvailability();
  void  composeWires();
  void  composeRawAvailability();
  void  composeRaw();


  // Assns.
  void  composeAssociations();

  template<typename A, typename B>
  void  composeAssociation();

  // Utility functions.
  int         pointOffLine(const TLorentzVector& x0, const TLorentzVector& pv, const TLorentzVector& x, double tol);
  
  template<typename T>
  std::vector<std::pair<std::string,art::InputTag>>  findByType(TTree* fTree);
  

  JsonObject& fOutput; // Top-level output object
  JsonObject fStats; // Processing metadata
  Long64_t fEntry;
  std::string fOptions;
  
  std::unique_ptr<gallery::Event> fEvent;
  std::unique_ptr<GalleryAssociationHelper> fAssnHelper;
  
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

  std::vector<std::string> fBranchNames;
};



#endif 


