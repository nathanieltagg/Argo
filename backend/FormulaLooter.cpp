#include <TTree.h>
#include <TTreeFormula.h>
#include <vector>
#include <string>
#include <iostream>
#include "FormulaLooter.h"

using std::vector;
using std::pair;
using std::string;


//syntactic sugar.
// template <typename ...Tail>
// JsonArray FormulaMakeArray(TTree* tree, const vector<pair< string,string> >& key_formula_pairs, const std::string& key, const std::string form)
// {
//   
// }


JsonElement FormulaMakeElement(TTree* tree, const std::string& formula)
{
  TTreeFormula ttf("tmp",formula.c_str(),tree);
  if(ttf.GetNdata()<1) return JsonElement();
  double v = ttf.EvalInstance(0);
  if(ttf.IsInteger()) return JsonElement((int)v);
  return JsonElement(v);
}

template <class ...B> 
JsonArray FormulaMakeArray(TTree* tree, std::vector<std::pair< std::string,std::string> >& key_formula_pairs, 
                           const std::string& k, const std::string& f,  B... argTail)
{
  key_formula_pairs.push_back(make_pair(k,f));
  return FormulaMakeArray(tree,key_formula_pairs,argTail...);
}

template <class ...B> 
JsonArray FormulaMakeArray(TTree* tree, const std::string& k, const std::string& f, B... argTail)
{
  std::vector<std::pair< std::string,std::string> > v;
  return FormulaMakeArray(tree,v,k,f,argTail...);
}

JsonArray FormulaMakeArray(TTree* tree, const vector<pair< string,string> >& key_formula_pairs)
{
  if(key_formula_pairs.size()<1) return JsonArray(); 
  vector<TTreeFormula*> formulae;
  for(auto row : key_formula_pairs ) {
    const string& key = row.first;
    const string& formula = row.second;
    formulae.push_back(new TTreeFormula(key.c_str(),formula.c_str(),tree));    
  }
  Int_t n = formulae[0]->GetNdata();
  for(auto formula : formulae) {
    if(formula->GetNdata() != n) {
      std::cerr <<" Error!  Formula  " << formula->GetName() << " does not match entries to " << formulae[0]->GetName() << std::endl;
      return JsonArray();
    }
  }
  JsonArray retval;
  for(Int_t i=0; i< n; i++) {
    JsonObject t;
    for(auto formula : formulae) {
      double v = formula->EvalInstance(i);
      if(formula->IsInteger()) { t.add(formula->GetName(),(int)v);}
      else t.add(formula->GetName(),v);
    }
    retval.add(t);    
  }
  for(auto formula : formulae) {
    delete formula; formula = 0;
  }
  return retval;
}



JsonArray test_fma(TTree* tree)
{
  vector<pair< string,string> > ps;
  return FormulaMakeArray(tree
      ,"t","recob::Hits_ffthit__Reco.obj.fPeakTime"
      ,"wire","recob::Hits_ffthit__Reco.obj.fWireID.Wire"
      ,"plane","recob::Hits_ffthit__Reco.obj.fWireID.Plane"
    );
}