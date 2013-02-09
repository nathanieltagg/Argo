#ifndef MAKE_XML_H
#define MAKE_XML_H



#include <string>
#include <TObject.h>
#include <TTime.h>
#include "JsonElement.h"

extern TTime  gTimeStart;


class TTree;

std::string ComposeResult( const char* inOptions,
                        const char* inRootFile,
                        const char* inSelection,
                        Long64_t entrystart=0,
                        Long64_t entryend=1000000000                       
                        );



#endif /* MAKE_XML_H */

