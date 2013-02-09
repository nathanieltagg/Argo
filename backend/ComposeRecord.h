#ifndef COMPOSERECORD_H
#define COMPOSERECORD_H


#include "JsonElement.h"
#include "TObject.h"
class TTree;

void ComposeRecord( JsonObject& outXml, TTree* inTree, Long64_t inEntry);


#endif 


