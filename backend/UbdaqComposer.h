#ifndef UbdaqComposer_H
#define UbdaqComposer_H


#include "Composer.h"
#include <math.h>
#include "Plexus.h"

// Forward declaration
namespace gov { namespace fnal { namespace uboone { namespace datatypes { class ub_EventRecord; }}}}


class UbdaqComposer : public Composer{
public:
  UbdaqComposer();
  ~UbdaqComposer();
  
  virtual void initialize();
  
  virtual bool can_satisfy(Request_t) {return true;};

  // To be called if there's a file
  virtual void satisfy_request(Request_t request, Result_t output);

  // To be called by the LIVE system, with dispatcher input
  virtual void satisfy_request(Request_t request, Result_t,
     std::shared_ptr<gov::fnal::uboone::datatypes::ub_EventRecord> record);

   std::string m_current_event_dir_name;
   std::string m_current_event_url;

   protected:
  void compose();
  void composeHeader();
  bool composeHeaderTrigger(nlohmann::json& trig);
  void composeTPC();
  void composeTPC_SN();
  void composePMTs();
  void composeLaser();

  void getPmtFromCrateCardChan(int icrate, int icard,int ichan, int& outPmt, int& outGain,  std::string& outSpecial);

  std::shared_ptr<gov::fnal::uboone::datatypes::ub_EventRecord> m_record;
  
  //configuration:
  bool        m_CreateSubdirCache;  
  std::string m_CacheStoragePath; 
  std::string m_CacheStorageUrl;
  std::string m_WorkingSuffix;
  std::string m_FinalSuffix;
  size_t      m_max_threads;
  
  std::string m_options;
  
    
  // State things:
  int fmintdc;
  int fmaxtdc;
  double event_time;
  uint32_t m_trig_frame      ;
  uint32_t m_trig_time_2MHz  ;
  uint32_t m_trig_time_16MHz ;
  uint32_t m_trig_time_64MHz ;
  
  
  nlohmann::json  m_stats;  
};

extern gov::fnal::uboone::online::Plexus gPlexus;




#endif 


