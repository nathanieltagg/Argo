#include "TreeElementLooter.h"

#include <TTree.h>
#include <TBranch.h>
#include <TFile.h>
#include <TBranchElement.h>
#include <TStreamerInfo.h>
#include "TVirtualCollectionProxy.h"

#include <iostream>
#include <vector>

// special code to try to get, for example,  vector<float> out of a leaf.
// Copied liberally from TBranchElement::PrintValue and GetCollectionProxy()->PrintValueSTL


TreeElementLooter::TreeElementLooter(TTree* t, const std::string& branchname) : fTree(t), fName(branchname), fBranch(0),  ok(false) {};

int TreeElementLooter::Setup() 
{
    TBranch* b = fTree->GetBranch(fName.c_str());
    if(!b) {
      fError = "TreeStlElementLooter: Couldn't find branch " + fName;  
      std::cerr << fError << std::endl;
      return 1;
    }

    fBranch = dynamic_cast<TBranchElement*>(b);
    if(!fBranch) {
      fError = "TreeStlElementLooter: Branch " + fName + " couldn't be cast to TBranchElement";  
      std::cerr << fError << std::endl;
      return 1;
    }
      
    fProxy = fBranch->GetCollectionProxy();
    if (!(fProxy)) {
      fError = "TreeStlElementLooter: Couldn't GetCollectionProxy() on " + fName;
      std::cerr << fError << std::endl;
      return 1;
    }
    fProxy->PushProxy(fBranch->GetObject());
    
    if (!(fBranch->GetInfo())) {
      fError = "TreeStlElementLooter: Couldn't GetInfo() on " + fName;
      std::cerr << fError << std::endl;
      return 1;
    }
      
    eoffset = fBranch->GetOffset();
    offset = eoffset + fBranch->GetInfo()->GetOffsets()[fBranch->GetID()];
    ok = true;
    return 0;
}

template<typename T> 
const T* TreeElementLooter::get(UInt_t row) 
{
    if(!ok) return 0;
    char* pointer = (char*)fProxy->At(row);
    char* ladd = pointer+offset;
    return (T*)(ladd);      // Unchecked cast!
}
  
TreeElementLooter::~TreeElementLooter(){
  if(fProxy) fProxy->PopProxy();
}

// Make sure templates are instantiated
using std::vector;
template const vector<float>* TreeElementLooter::get< vector<float> >(UInt_t row);

