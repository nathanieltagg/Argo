#ifndef MAKE_XML_H
#define MAKE_XML_H

#include <memory>
#include <TObject.h>
#include <TTime.h>
#include "JsonElement.h"
#include <map>
#include <string>

extern TTime  gTimeStart;

class TTree;
class TFile;

class ResultComposer
{
  public:
   typedef std::map<std::string,std::string> config_t ;
   ResultComposer(const config_t& config = config_t());

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
   std::map<std::string,std::string> m_config;
   
};


#endif /* MAKE_XML_H */

