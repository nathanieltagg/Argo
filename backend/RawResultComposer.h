#ifndef MAKE_XML_H
#define MAKE_XML_H


#include <TObject.h>
#include "JsonElement.h"
#include "Timer.h"

extern Timer gStartTimer;

class TTree;
class TFile;

class RawResultComposer
{
  public:
   RawResultComposer();

   std::string compose(  const char* inOptions,
                         const char* inPath,
                         const char* inSelection,
                         Long64_t entrystart=0,
                         Long64_t entryend=1000000000                       
                         );  

   ~RawResultComposer();
   JsonObject result;
};


#endif /* MAKE_XML_H */

