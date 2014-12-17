#ifndef RECORDCOMPOSER_H
#define RECORDCOMPOSER_H



#include "JsonElement.h"
#include "TreeReader.h"
#include "TObject.h"
#include "WirePalette.h"
#include <math.h>
#include <vector>
#include <memory>

class TTree;
class TreeElementLooter;
class TLorentzVector;



class RecordComposer {
public:
  RecordComposer(JsonObject& output, TTree* tree, Long64_t jentry, const std::string options);
  ~RecordComposer();
  void compose();
  void  composeHeaderData();

  // Reco
  void  composeHits();
  void  composeClusters();
  void  composeVertex2d();
  void  composeSpacepoints();
  void  composeTracks();
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
  
  void        hsvToRgb(unsigned char* out, float h, float s, float v);
  std::string stripdots(const std::string& s);
  JsonObject  GetClusterWireAndTDC(TreeElementLooter& l, int row);
  void        wireOfChannel(int channel, int& plane, int& wire);
  int         pointOffLine(const TLorentzVector& x0, const TLorentzVector& pv, const TLorentzVector& x, double tol);
  
  
  // Mapping from any adc value onto an 8-bit integer for crude color purposes.
  
  int inline static tanscale(float adc) 
  {
    return int(atan(adc/50.)/M_PI*256.) + 127;  
  }

  float inline static inv_tanscale(int y) 
  {
    return tan((y-127)*M_PI/256)*50.;
  }
  
  
  JsonObject& fOutput; // Top-level output object
  JsonObject fStats; // Processing metadata
  TTree* fTree;
  Long64_t fEntry;
  std::string fOptions;
  TreeReader ftr;
  static std::string sfFileStoragePath;
  static std::string sfUrlToFileStorage;
  
};



#endif 


