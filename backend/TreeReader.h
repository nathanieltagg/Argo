#ifndef TREEREADER_H
#define TREEREADER_H
// 
// TreeReader
// This is the code that knows how to read Trees.
// The basic version of this code uses raw Leaf commands to get values.
// The more advanced code uses TTreeFormula, when the basic stuff is just too complicated to wade through.
//   It's probably slower, but speed is not the most important issue for the back-end.
//


class TTree;
class TLeaf;
#include <TObject.h>
#include <string>
#include <map>
#include <vector>
//#include <XmlElement.h>
#include "JsonElement.h"

class TreeReader
{
public:
  TreeReader(TTree* tree);
  ~TreeReader();
  
  // Commands to get values from named leaves.
  Double_t    getVal(TLeaf* leaf, int index = 0, int second_index = -1);
  Double_t    getVal(const std::string& leafname, int index = 0, int second_index = -1);
  Int_t       getInt(const std::string& leafname, int index = 0, int second_index = -1)
              {  return (Int_t)getVal(leafname,index,second_index); }  // FIXME - casting here converts, might have roundoff error.
  Int_t       getInt(TLeaf* leaf, int index = 0, int second_index = -1)
              {  return (Int_t)getVal(leaf,index,second_index); }  // FIXME ditto

  std::string getStr(TLeaf* leaf, int index = 0, int second_index = -1);
  
  // Commands to get values via TTreeFormulas.
  Double_t    getF(const std::string& formula, int index = 0);
  JsonElement jsonF(const std::string& formula, int index = 0);

  JsonArray   makeArray(const std::vector<std::pair< std::string,std::string> >& key_formula_pairs);
  
  // Syntactic sugar: makeArray("key1","formula1","key2","formula2",...)
  template <class ...B> 
    JsonArray makeArray(const std::string& k, const std::string& f, B... argTail);

  // For the syntactic sugar to work.
  template <class ...B> 
      JsonArray makeArray(std::vector<std::pair< std::string,std::string> >& key_formula_pairs, 
                               const std::string& k, const std::string& f,  B... argTail);
    

  // Obsoleted.
  // XmlElement  getXml(const std::string& tagname, const std::string& leafname, int index = 0, int second_index = -1);
  // XmlElement  getXml(const std::string& tagname, TLeaf* leaf, int index = 0, int second_index = -1);
  // XmlElement  getXmlArray(const std::string& tagname, const std::string& leafname);
  // XmlElement  getXmlArray(const std::string& tagname, const std::string& leafname, int index); // loop over second index.
    
  TTree* fTree;
  Double_t fDefaultValue;
};

template <class ...B> 
JsonArray TreeReader::makeArray(const std::string& k, const std::string& f, B... argTail)
{
  std::vector<std::pair< std::string,std::string> > v;
  return makeArray(v,k,f,argTail...);
}

template <class ...B> 
JsonArray TreeReader::makeArray(std::vector<std::pair< std::string,std::string> >& key_formula_pairs, 
                                const std::string& k, const std::string& f,  B... argTail)
{
  key_formula_pairs.push_back(make_pair(k,f));
  return makeArray(key_formula_pairs,argTail...);
}



#endif /* TreeReader_H */


