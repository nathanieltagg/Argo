#ifndef ANALYSISTREECOMPOSER_H
#define ANALYSISTREECOMPOSER_H

#include "Composer.h"
#include "TreeReader.h"
#include "TObject.h"
#include <math.h>
#include <vector>

class TFile;
class TTree;
class TreeElementLooter;
class TLorentzVector;


class AnalysisTreeComposer : public Composer{
public:
  AnalysisTreeComposer();
  virtual ~AnalysisTreeComposer();
  
  virtual void initialize();
  virtual bool can_satisfy(Request_t) {return true;};
  virtual void satisfy_request(Request_t request, Result_t output);
  
protected:
  void compose();
  
  void composeHeader();
  void composeHits();
  void composeTracks();
  void composeOpFlash();
  
  nlohmann::json  m_stats;
  std::string m_filename;
  TFile*      m_file;
  TTree*      m_tree;
  Long64_t    m_entry;
  std::string m_options;
  TreeReader  m_tr;
 
  double event_time;
  
  boost::mutex m_result_mutex;
  
};



#endif 


