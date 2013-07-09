#ifndef RECORDCOMPOSER_H
#define RECORDCOMPOSER_H



#include "JsonElement.h"
#include "TreeReader.h"
#include "TObject.h"
#include <math.h>
class TTree;

class RecordComposer {
public:
  RecordComposer(JsonObject& output, TTree* tree, Long64_t jentry, const std::string options);
  ~RecordComposer();
  void compose();
  void  composeHeaderData();

  // Reco
  void  composeHits();
  void  composeClusters();
  void  composeSpacepoints();
  void  composeTracks();

  // Optical
  void  composeOpFlashes();
  void  composeOpHits();

  // Wires
  void  composeCalAvailability(); 
  void  composeRawAvailability(); 
  void  composeCal();
  void  composeRaw();
  
  // Monte carlo
  void  composeMC();


  // Utility functions.
  std::vector<std::string> findLeafOfType(std::string pattern);
  
  
  // Mapping from any adc value onto an 8-bit integer for crude color purposes.
  
  int tanscale(float adc) 
  {
    return int(atan(adc/50.)/M_PI*256.) + 127;  
  }

  float inv_tanscale(int y) 
  {
    return tan((y-127)*M_PI/256)*50.;
  }
  
  
  JsonObject& fOutput; // Top-level output object
  TTree* fTree;
  Long64_t fEntry;
  std::string fOptions;
  TreeReader ftr;
  static std::string sfFileStoragePath;
  static std::string sfUrlToFileStorage;
  
  std::vector<unsigned char> fPalette;
  std::vector<unsigned char> fPaletteTrans;
};



#endif 


