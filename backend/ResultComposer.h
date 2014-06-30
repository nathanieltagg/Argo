#ifndef MAKE_XML_H
#define MAKE_XML_H


#include <TObject.h>
#include <TTime.h>
#include "JsonElement.h"

extern TTime  gTimeStart;

class TTree;
class TFile;

class ResultComposer
{
  public:
   ResultComposer();

   std::string compose(  const char* inOptions,
                         const char* inRootFile,
                         const char* inSelection,
                         Long64_t entrystart=0,
                         Long64_t entryend=1000000000                       
                         );  

   ~ResultComposer();
   TFile* rootfile;
   TTree* tree;
   JsonObject result;
   
   static UInt_t events_served;
};


#endif /* MAKE_XML_H */

