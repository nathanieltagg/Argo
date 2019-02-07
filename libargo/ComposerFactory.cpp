#include "ComposerFactory.h"
#include "json.hpp"
#include "json_tools.h"
#include "TROOT.h"
#include <TSystem.h>
#include <TFile.h>
#include <iostream>

#include "GalleryComposer.h"
#include "UbdaqComposer.h"
#include "AnalysisTreeComposer.h"
#include "LarliteComposer.h"
#include "ForkedComposer.h"
#include <exception>

using nlohmann::json;
size_t ComposerFactory::events_served = 0;


#include <gallery/Event.h>

ComposerFactory::ComposerFactory()
  : m_config(std::shared_ptr<json>(new json(json::object())))
  , m_composer_seq(0)
{};

void ComposerFactory::configure(const Config_t config)
{
  if(config) {
    m_config = config;
  } 
  m_max_age = m_config->value("max_age",200000); // default 200s
  m_max_composers = m_config->value("max_composers",0); 
  
}

struct CompareAges
{
   bool operator()(const std::pair<int, long>& left, const std::pair<int, long>& right) const
     { return left.second < right.second; }
};
 
 
Output_t ComposerFactory::compose(Request_t request, Composer::ProgressCallback_t progress_callback)
{
  long eventTimeStart = gSystem->Now();

  
  if(!request) {
    return Composer::return_error("Bad request");
  }

  std::string filename = "";
  try {
    filename = request->value("filename","");
  } catch(...) {};
  if(filename=="") {
    return Composer::return_error("No filename!");
  }

  // Did the user specifically request an existing Composer thread? (This could be a re-request or a request for a new event in the same file.)
  int rid = request->value("composer_id",0);
   
  // cleaup any old composers laying around.
  bool cleaning_up = true;
  do {
    boost::mutex::scoped_lock lock(m_factory_mutex);
    cleaning_up = false;
    size_t n = m_composers.size();
    if(n>0) {
      auto it = min_element(m_composer_births.begin(), m_composer_births.end(), CompareAges()); 
      if((n>m_max_composers) || (it->second - eventTimeStart > m_max_age)) {
        int id = it->first;
        m_composers.erase(id);
        m_composer_births.erase(id);
        cleaning_up = true; // Might need to clean up more.
      }
    }
  } while(cleaning_up);
  

  if(rid>0) {
    // They requested one!
    auto it = m_composers.find(rid);
    if(it != m_composers.end()) {
      // Try this one!
      try {
        std::shared_ptr<Composer> c = it->second;
        if(c && c->can_satisfy(request)) {
          Output_t output = c->satisfy_request(request);
          if(output && output->size()>0) return output; // Yay!
        }
      } catch (...) {}
    }
  }
  
  // Next: What kind of file is being requested?

  try {
    bool is_daqfile = false;
    bool is_artfile = false;
    bool is_anafile = false;
    bool is_larlite = false;

    const std::string daqSuffix(".ubdaq");
    if( filename.length() >= daqSuffix.length() ) {
      is_daqfile = (0 == filename.compare( filename.length() - daqSuffix.length(), daqSuffix.length(), daqSuffix));
    }
    if(!is_daqfile) {
      TFile rootfile(filename.c_str(),"READ");
      if(rootfile.IsOpen()) {
        std::cout << "Can open file. "  << filename << std::endl;
        if(rootfile.Get("Events") )               is_artfile = true;
        if(rootfile.Get("analysistree/anatree") ) is_anafile = true;
        if(rootfile.Get("larlite_id_tree") )      is_larlite = true;
      } else {
        return Composer::return_error( "Can't open file! " + filename );
      }
      // delete rootfile;
    }
  
 
    std::shared_ptr<Composer> composer;

    bool forking = m_config->value("forking",false);
    if(forking) {
      if     (is_daqfile) composer.reset(new ForkedComposer<UbdaqComposer       >()   );
      else if(is_artfile) composer.reset(new ForkedComposer<GalleryComposer     >()   );
      else if(is_anafile) composer.reset(new ForkedComposer<AnalysisTreeComposer>()   );
      else if(is_larlite) composer.reset(new ForkedComposer<LarliteComposer     >()   );
      else {
        return Composer::return_error( "Unrecognized file type: " + filename );
      }        
    } else {
      if     (is_daqfile) composer.reset(new UbdaqComposer()        );
      else if(is_artfile) composer.reset(new GalleryComposer()      );
      else if(is_anafile) composer.reset(new AnalysisTreeComposer() );
      else if(is_larlite) composer.reset(new LarliteComposer()      );
      else {
        return Composer::return_error( "Unrecognized file type: " + filename );
      }    
    }
  
    if(m_max_composers > 0) {
      boost::mutex::scoped_lock lock(m_factory_mutex);
      m_composer_seq++;    
    
      m_composers[m_composer_seq] = composer;
      m_composer_births[m_composer_seq] = (long)gSystem->Now();    
    }
    composer->configure(m_config,m_composer_seq);
    composer->set_progress_callback(progress_callback);
    composer->initialize();
  
  
    Output_t output;
    try{
      output = composer->satisfy_request(request);
    } catch(const std::exception& e) {
      return Composer::return_error( std::string("Caught exception in Composer: ") + e.what() );
    } catch(...) {
      return Composer::return_error( "Caught exception in Composer with unknown exception" );
    }


    long eventTimeEnd = gSystem->Now();
    std::cout << "Total factory time: " << eventTimeEnd - eventTimeStart << std::endl;
    return output;
  } catch (std::exception& e) {
    return Composer::return_error( std::string("Exception:") + e.what() );
    
  }
}

