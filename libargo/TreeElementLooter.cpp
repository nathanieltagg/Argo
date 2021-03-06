#include "TreeElementLooter.h"

#include <TTree.h>
#include <TBranch.h>
#include <TFile.h>
#include <TBranchElement.h>
#include <TLorentzVector.h>
#include <TStreamerInfo.h>
#include "TVirtualCollectionProxy.h"

#include <iostream>
#include <vector>

// special code to try to get, for example,  vector<float> out of a leaf.
// Copied liberally from TBranchElement::PrintValue and GetCollectionProxy()->PrintValueSTL


TreeElementLooter::TreeElementLooter(TTree* t, const std::string& branchname) 
  : fTree(t), fName(branchname), fBranch(0),  fOK(false) 
{
  TBranch* b = fTree->GetBranch(fName.c_str());
  if(!b) {
    fError = "TreeElementLooter: Couldn't find branch " + fName;  
    std::cerr << fError << std::endl;
    return;
  }

  fBranch = dynamic_cast<TBranchElement*>(b);
  if(!fBranch) {
    fError = "TreeElementLooter: Branch " + fName + " couldn't be cast to TBranchElement";  
    std::cerr << fError << std::endl;
    return;
  }
    
  fProxy = fBranch->GetCollectionProxy();
  if (!(fProxy)) {
    fError = "TreeElementLooter: Couldn't GetCollectionProxy() on " + fName;
    std::cerr << fError << std::endl;
    return;
  }
  fProxy->PushProxy(fBranch->GetObject());
  
  if (!(fBranch->GetInfo())) {
    fError = "TreeElementLooter: Couldn't GetInfo() on " + fName;
    std::cerr << fError << std::endl;
    return;
  }
    
  eoffset = fBranch->GetOffset();
#if ROOT_VERSION_CODE >= ROOT_VERSION(5,34,21)
  offset = eoffset + fBranch->GetInfo()->GetElementOffset(fBranch->GetID());
#else
  offset = eoffset + fBranch->GetInfo()->GetOffsets()[fBranch->GetID()];
#endif

  // ROOT v5_34_21b
  fOK = true;
}


  
TreeElementLooter::~TreeElementLooter(){
  if(fProxy && fOK) fProxy->PopProxy();
}

char* TreeElementLooter::getAddress(UInt_t row) 
{
  if(!fOK) return 0;
  char* pointer = (char*)fProxy->At(row);
  char* ladd = pointer+offset;
  return ladd;
}


// Make sure templates are instantiated
using std::vector;
template const vector<float>* TreeElementLooter::get< vector<float> >(UInt_t row);
template const vector<short>* TreeElementLooter::get< vector<short> >(UInt_t row);
template const vector<std::pair<TLorentzVector,TLorentzVector> >* TreeElementLooter::get< vector<std::pair<TLorentzVector,TLorentzVector> > >(UInt_t row);


