#ifndef RESULT_COMPOSER_H
#define RESULT_COMPOSER_H


// NB Keep this file as clean as possible: no dependencies.

#include <memory>
#include <map>
#include <string>

void ArgoInitGlobals(); // For ROOT and stuff.

class TTree;
class TFile;
class JsonObject;

class ResultComposer
{
  public:
   typedef std::map<std::string,std::string> config_t ;
   ResultComposer(const config_t& config = config_t());

   std::shared_ptr<std::string> compose(  const char* inOptions,
                                          const char* inRootFile,
                                          const char* inSelection,
                                          int64_t entrystart=0,
                                          int64_t entryend=1000000000                       
                                          );  


  

   ~ResultComposer();
   
   static size_t events_served;

 private:
   void compose_from_raw(  const char* inOptions,
                                          const char* inRootFile,
                                          const char* inSelection,
                                          int64_t entrystart=0,
                                          int64_t entryend=1000000000                       
                                          );  
                                          
   void compose_from_art(  const char* inOptions,
                                         const char* inRootFile,
                                         const char* inSelection,
                                         int64_t entrystart=0,
                                         int64_t entryend=1000000000                       
                                         );  

   void compose_from_ana(  const char* inOptions,
                                         const char* inRootFile,
                                         const char* inSelection,
                                         int64_t entrystart=0,
                                         int64_t entryend=1000000000                       
                                         );  
   
   void compose_from_larlite(  const char* inOptions,
                                         const char* inRootFile,
                                         const char* inSelection,
                                         int64_t entrystart=0,
                                         int64_t entryend=1000000000                       
                                         );  
   
   void addMonitorData();

   TFile* rootfile;
   TTree* tree;
   std::shared_ptr<JsonObject> result;
   std::map<std::string,std::string> m_config;
   
};


#endif /* RESULT_COMPOSER_H */

