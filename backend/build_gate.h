#ifndef BUILD_GATE_H
#define BUILD_GATE_H

#include "XmlElement.h"
#include "TObject.h"
class TTree;

void build_gate( XmlElement& outXml, TTree* inTree, Long64_t inEntry,
                 Int_t majorVer,
                 Int_t revVer,
                 Int_t patchVer,
                 Int_t devVer );


#endif /* BUILD_GATE_H */


