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
#include <string>
#include <map>
#include <vector>
//#include <XmlElement.h>
// #include "JsonElement.h"
#include "json_fwd.hpp"

class TreeReader
{
public:
  TreeReader(TTree* tree = nullptr);
  ~TreeReader();
  void        setTree(TTree* tree) { fTree=tree; }
  
  // Commands to get values from named leaves.
  double    getVal(TLeaf* leaf, int index = 0, int second_index = -1);
  double    getVal(const std::string& leafname, int index = 0, int second_index = -1);
  int       getInt(const std::string& leafname, int index = 0, int second_index = -1)
              {  return (int)getVal(leafname,index,second_index); }  // FIXME - casting here converts, might have roundoff error.
  int       getInt(TLeaf* leaf, int index = 0, int second_index = -1)
              {  return (int)getVal(leaf,index,second_index); }  // FIXME ditto
  

  std::string getStr(TLeaf* leaf, int index = 0, int second_index = -1);

  nlohmann::json getJson(const std::string& leafname, int index = 0, int second_index = -1);
  nlohmann::json getJson(TLeaf* leaf, int index = 0, int second_index = -1);
  
  nlohmann::json   makeArray(const std::vector<std::pair< std::string,std::string> >& key_leaf_pairs, int limit=9999999);
  nlohmann::json   makeFArray(const std::vector<std::pair< std::string,std::string> >& key_formula_pairs);

  nlohmann::json   makeSimpleFArray(const std::string& k);


  // Commands to get values via TTreeFormulas.
  double         getF(const std::string& formula, int index = 0);
  nlohmann::json jsonF(const std::string& formula, int index = 0);


  // 
  // // Syntactic sugar: makeArray("key1","formula1","key2","formula2",...)
  // template <class ...B> 
  //   JsonArray makeArray(const std::string& k, const std::string& f, B... argTail);
  // 
  // // For the syntactic sugar to work.
  // template <class ...B> 
  //     JsonArray makeArray(std::vector<std::pair< std::string,std::string> >& key_leaf_pairs, 
  //                              const std::string& k, const std::string& f,  B... argTail);
  // 
  // 
  // 
  // // Syntactic sugar: makeArray("key1","formula1","key2","formula2",...)
  // template <class ...B> 
  //   JsonArray makeFArray(const std::string& k, const std::string& f, B... argTail);
  // 
  // // For the syntactic sugar to work.
  // template <class ...B> 
  //     JsonArray makeFArray(std::vector<std::pair< std::string,std::string> >& key_formula_pairs, 
  //                              const std::string& k, const std::string& f,  B... argTail);
  //   

  // Obsoleted.
  // XmlElement  getXml(const std::string& tagname, const std::string& leafname, int index = 0, int second_index = -1);
  // XmlElement  getXml(const std::string& tagname, TLeaf* leaf, int index = 0, int second_index = -1);
  // XmlElement  getXmlArray(const std::string& tagname, const std::string& leafname);
  // XmlElement  getXmlArray(const std::string& tagname, const std::string& leafname, int index); //.
    
  TTree* fTree;
  double fDefaultValue;
};




///////////////////////////
// 
// 
// template <class ...B> 
// JsonArray TreeReader::makeArray(const std::string& k, const std::string& f, B... argTail)
// {
//   std::vector<std::pair< std::string,std::string> > v;
//   return makeArray(v,k,f,argTail...);
// }
// 
// template <class ...B> 
// JsonArray TreeReader::makeArray(std::vector<std::pair< std::string,std::string> >& key_leaf_pairs, 
//                                 const std::string& k, const std::string& f,  B... argTail)
// {
//   key_leaf_pairs.push_back(make_pair(k,f));
//   return makeArray(key_leaf_pairs,argTail...);
// }
// 
// ///////////////////////////
// 
// template <class ...B> 
// JsonArray TreeReader::makeFArray(const std::string& k, const std::string& f, B... argTail)
// {
//   std::vector<std::pair< std::string,std::string> > v;
//   return makeFArray(v,k,f,argTail...);
// }
// 
// template <class ...B> 
// JsonArray TreeReader::makeFArray(std::vector<std::pair< std::string,std::string> >& key_formula_pairs, 
//                                 const std::string& k, const std::string& f,  B... argTail)
// {
//   key_formula_pairs.push_back(make_pair(k,f));
//   return makeFArray(key_formula_pairs,argTail...);
// }



#endif /* TreeReader_H */


