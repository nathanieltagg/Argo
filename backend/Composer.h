#ifndef Composer_H
#define Composer_H

#include "json.hpp"
#include <boost/thread.hpp>
#include <memory>


typedef std::shared_ptr<nlohmann::json> Request_t ;
typedef std::shared_ptr<nlohmann::json> Config_t  ;
typedef std::shared_ptr<std::string>    Output_t  ;
typedef std::shared_ptr<nlohmann::json> Json_t ;

class TTree;

// Base class defines common interface

#include <iostream>




class Composer {
public:
  
  
  Composer() : m_result(nlohmann::json::object())
             , m_progress_target(1)
             , m_progress_so_far(0)
      { }; // Constructor
  virtual ~Composer()  {}; // Destructor
  
  virtual void configure(Config_t config, int id=0) { m_config = config; m_id = id; }
  virtual void initialize(){};
  
  // Required: return true if we can satisfy the request.
  // If false, a new composer object will be instantiated to fulfill it.
  // Called only if the client specifically requests us.
  virtual bool can_satisfy(Request_t) {return false;};

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
  
  typedef std::string  ConstituentAddress_t;  // Actually a jsonPointer
  struct Constituent_t{
    ConstituentAddress_t m_address;
    Json_t             m_data;
    boost::mutex         m_mutex;
  };

  // Composer may also need something like std::map<ConsitutentAddress,InputTag> to keep track of things.
  typedef std::map<ConstituentAddress_t,Constituent_t> Constituents_t;

  boost::mutex   m_mutex;
  Request_t      m_request;
  Constituents_t m_consistuents;
  Json_t         m_manifest;  // empty JSON framework. Do we need this?
  int            m_id;
  Config_t       m_config;
  nlohmann::json m_result;
  

public:
  static Output_t return_error(const std::string& err) 
  {
    nlohmann::json j;
    j["error"] = err;
    std::cerr << err << std::endl;
    return Output_t(new std::string(j.dump()));
  }
  
  // Progress meter stuff:
public:
  typedef std::function<void(float,const std::string&)> ProgressCallback_t;
  virtual void set_progress_callback(ProgressCallback_t cb) {m_progress_callback = cb;}
  
protected:
  ProgressCallback_t m_progress_callback;
  float              m_progress_target;
  float              m_progress_so_far;
  // used by caller:
  void progress_made(const std::string msg="",float increment=1) {
    m_progress_so_far+=increment;
    float frac = m_progress_so_far/m_progress_target;
    if(m_progress_callback) m_progress_callback(frac,msg);
  }
  
};

// Might want to wrap this guy so that he can be spoken to via forks
// template<class C>
// class ComposerFork {
//   int         _pipefd;
//   bool        _we_are_client;
//   Composer*   _composer;
//   ComposerFork(const Config_t& config) {}
//   int fork() {
//     // Fork a process.
//     // If we're the server, return.
//     // If we're the client, start to listen for requests.
//   }
//   int client_listen_for_requests() {
//     // listen to pipe
//     // If we get a complete request, satisfy it and return.
//   }
//   virtual int satisfy_request(const Request_t& request, JsonObject& output) {
//     // called by server, send request to pipe and listen for reply.
//     // maybe needs a callback function?
//     //
//   }
//   Config_t& config;
// };






#endif 


