#include "UniversalComposer.h"
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

UniversalComposer::UniversalComposer()
{
  std::cout <<"UniversalComposer ctor" << std::endl;
}

UniversalComposer::~UniversalComposer()
{
  std::cout <<"UniversalComposer dtor" << std::endl;
}

 
Output_t UniversalComposer::satisfy_request(Request_t request)
{
  long eventTimeStart = gSystem->Now();
  
  if(!request) {
    return Error("Bad request");
  }

  // Check if we've already got a worker we can call on.
  if(m_composer && m_composer->can_satisfy(request)) {
    m_composer->set_output_callback(m_output_callback);
    return m_composer->satisfy_request(request);    
  }
      
  std::string filename = "";
  try {
    filename = request->value("filename","");
  } catch(...) {};
  if(filename=="") {
    return Error("No filename!");
  }
  if(m_filename.length()>0 && filename!=m_filename)
    return Error("Wrong file, need a new composer");


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
        return Error( "Can't open file! " + filename );
      }
      // delete rootfile;
    }
  
 
    m_composer.reset(); // releases old one if required.

    bool forking = m_config->value("forking",false);
    if(forking) {
      if     (is_daqfile) m_composer.reset(new ForkedComposer<UbdaqComposer       >()   );
      else if(is_artfile) m_composer.reset(new ForkedComposer<GalleryComposer     >()   );
      else if(is_anafile) m_composer.reset(new ForkedComposer<AnalysisTreeComposer>()   );
      else if(is_larlite) m_composer.reset(new ForkedComposer<LarliteComposer     >()   );
      else {
        return Error( "Unrecognized file type: " + filename );
      }        
    } else {
      if     (is_daqfile) m_composer.reset(new UbdaqComposer()        );
      else if(is_artfile) m_composer.reset(new GalleryComposer()      );
      else if(is_anafile) m_composer.reset(new AnalysisTreeComposer() );
      else if(is_larlite) m_composer.reset(new LarliteComposer()      );
      else {
        return Error( "Unrecognized file type: " + filename );
      }    
    }
  
    m_composer->configure(m_config);
    m_composer->set_output_callback(m_output_callback);
    
    Output_t output;
    try{
      output = m_composer->satisfy_request(request);
    } catch(const std::exception& e) {
      return Error( std::string("Caught exception in Composer: ") + e.what() );
    } catch(...) {
      return Error( "Caught exception in Composer with unknown exception" );
    }


    long eventTimeEnd = gSystem->Now();
    std::cout << "Total factory time: " << eventTimeEnd - eventTimeStart << std::endl;
    return output;
  } catch (std::exception& e) {
    return Error( std::string("Exception:") + e.what() );
    
  }
}

