#ifndef MAKE_XML_H
#define MAKE_XML_H

#include <memory>
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

   std::shared_ptr<std::string> compose(  const char* inOptions,
                                          const char* inRootFile,
                                          const char* inSelection,
                                          Long64_t entrystart=0,
                                          Long64_t entryend=1000000000                       
                                          );  


  

   ~ResultComposer();

   static UInt_t events_served;

 private:
   void compose_from_raw(  const char* inOptions,
                                          const char* inRootFile,
                                          const char* inSelection,
                                          Long64_t entrystart=0,
                                          Long64_t entryend=1000000000                       
                                          );  
                                          
   void compose_from_art(  const char* inOptions,
                                         const char* inRootFile,
                                         const char* inSelection,
                                         Long64_t entrystart=0,
                                         Long64_t entryend=1000000000                       
                                         );  
   
   void addMonitorData();
   TFile* rootfile;
   TTree* tree;
   JsonObject result;
   
};


#endif /* MAKE_XML_H */

