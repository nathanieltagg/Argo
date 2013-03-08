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
  void  composeHits();
  void  composeCal();
  void  composeRaw();
  void  composeMC();
  
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
};



#endif 


