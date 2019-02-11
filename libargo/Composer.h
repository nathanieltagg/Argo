#ifndef Composer_H
#define Composer_H

#include "json.hpp"
#include <boost/thread.hpp>
#include <memory>


typedef std::shared_ptr<nlohmann::json> Request_t ;
typedef std::shared_ptr<nlohmann::json> Config_t  ;
typedef std::shared_ptr<std::string>    Output_t  ;


class TTree;

// Base class defines common interface

#include <iostream>




class Composer {
public:
  Composer();
  virtual ~Composer();
  
  virtual void configure(Config_t config, int id=0) { m_config = config; m_id = id; }
  
  // Required: return true if we can satisfy the request.
  // If false, a new composer object will be instantiated to fulfill it.
  // Called only if the client specifically requests us.
  // By default, it just reports if the filename matches.
  virtual bool can_satisfy(Request_t);

  // Need only satify this: 
  virtual Output_t satisfy_request(Request_t request);
  // Check to see if our current event matches the request.
  // Get the event specified in the request.
  // Build the _consituent map, including mutexes.
  // Start a thread pool
  // For each order in request/pointers:
  //   new thread (get_or_compose(pointer))
  // Wait for all threads to end.
  // Copy data from _consituents to the result.
  // output[pointer] = get_or_compose(pointer);
  // The get_or_compose

  // get or compose
  // virtual Json_t get_or_compose(std::string jsonPointer);
  // // May block.  May be put into a thread
  // // Put a read lock on the data pointed to by the jsonPointer, wait until released,
  // // See if there is data there. If not, upgrade to a write lock. Call compose() on that data.
  // // Return when data available.
  //
  // virtual void compose(std::string jsonPointer, Result_t& result);
  // // Compose. should ONLY be called from get_or_compose.
  // // No mutex locking required at this stage: compose the result json object (or array or whatever)

  // Utility function for finding events in a TTree.
  // Returns an entry number, with event loaded.
  int64_t find_entry_in_tree(TTree* inTree, std::string& inSelection, int64_t inStart, int64_t inEnd, std::string& outError);
  
  virtual nlohmann::json monitor_data();
  virtual Output_t       dump_result() { return Output_t(new std::string(m_result.dump())); }
  
  // typedef std::string  ConstituentAddress_t;  // Actually a jsonPointer
  // struct Constituent_t{
  //   ConstituentAddress_t m_address;
  //   Json_t             m_data;
  //   boost::mutex         m_mutex;
  // };

  // Composer may also need something like std::map<ConsitutentAddress,InputTag> to keep track of things.
  // typedef std::map<ConstituentAddress_t,Constituent_t> Constituents_t;

  boost::mutex   m_mutex;
  Request_t      m_request;
  // Constituents_t m_consistuents;
  // Json_t         m_manifest;  // empty JSON framework. Do we need this?
  int            m_id;
  Config_t       m_config;
  nlohmann::json m_result;
  

public:
  static Output_t Error(const std::string& err) 
  {
    nlohmann::json j;
    j["error"] = err;
    std::cerr << err << std::endl;
    return Output_t(new std::string(j.dump()));
  }

  // Message passing back to caller  
public:
  typedef unsigned short OutputType_t;
  enum OutputTypeEnum_t: OutputType_t {
    kUnknown     =0,  // error
    kEmpty       =1,  // No string, may be final
    kProgress    =2,  // Progress notification
    kPiecePreview=4,// The next message will be a kPiece, here's some metadata
    kPiece       =8, // An actual piece of data
    kRecord      =0x10, // Legacy: a complete record
    kFinal       =0x20, // This is the last record I'll return for this request
    kError       =0x40, // An error message. 
    kRetval      =0x100, // This is reserved for ForkedComposer to indicate a finished sequence
    kRequest     =0x200, // This is reserved for ForkedComposer to indicate a starting request.
  }; // note this is a bitmask.
  
  
  typedef std::function<void(OutputType_t type, Output_t)> OutputCallback_t;
  virtual void set_output_callback(OutputCallback_t cb) {m_output_callback = cb;}
  
  static std::string to_string(OutputType_t type);
  
protected:



  OutputCallback_t   m_output_callback;  
  std::string        m_filename;

  float              m_progress_target;
  float              m_progress_so_far;
  // used by caller:
  void progress_made(const std::string msg="",float increment=1) {
    if(m_output_callback) {
      m_progress_so_far+=increment;
      float frac = m_progress_so_far/m_progress_target;
      if(m_output_callback) 
        m_output_callback(kProgress,
                          Output_t(new std::string(
                              nlohmann::json({ { "progress", frac }, {"state", msg}}).dump()
                          ) )
                        );
      
    }
  }
  void dispatch_piece(const nlohmann::json& p) {
    if(m_output_callback) { m_output_callback(kPiece,Output_t(new std::string(p.dump()))); };
  }
  
  
};


#endif 


