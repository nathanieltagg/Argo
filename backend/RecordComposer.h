#ifndef RECORDCOMPOSER_H
#define RECORDCOMPOSER_H



#include "JsonElement.h"
#include "TreeReader.h"
#include "TObject.h"
class TTree;

class RecordComposer {
public:
  RecordComposer(JsonObject& output, TTree* tree, Long64_t jentry, const std::string options):
    fOutput(output), fTree(tree), fEntry(jentry), fOptions(options), ftr(tree) {};
    
  void compose();
  void  composeHeaderData();
  void  composeHits();
  void  composeWires();
  
  
  
  JsonObject& fOutput; // Top-level output object
  TTree* fTree;
  Long64_t fEntry;
  std::string fOptions;
  TreeReader ftr;
};



#endif 


