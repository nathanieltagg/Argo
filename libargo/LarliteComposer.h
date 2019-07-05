#ifndef LARLITERECORDCOMPOSER_H
#define LARLITERECORDCOMPOSER_H
#ifdef LARLITE


#include "Composer.h"
#include "TreeReader.h"
#include <math.h>
#include <vector>
#include <memory>

#include "DataFormat/storage_manager.h"



class LarliteComposer : public Composer{
public:
  LarliteComposer();
  ~LarliteComposer();
    
  virtual bool can_satisfy(Request_t) {return true;};

  virtual Output_t satisfy_request(Request_t request);
  
protected:

  void compose();
  void compose_header();
  void compose_hits();
  void compose_tracks();
  void compose_associations();
  
  

  ntagg::json  m_stats; // Processing metadata
  std::string     m_filename;
  long long       m_entry;
  std::string     m_options;
  
  larlite::storage_manager m_storage_manager;
    
  boost::mutex    m_result_mutex;
};


#else /* LARLITE */
class LarliteComposer : public Composer{};
#endif
#endif 


