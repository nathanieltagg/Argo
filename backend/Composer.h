#ifndef Composer_H
#define Composer_H

#include "json.hpp"
#include <boost/thread.hpp>
#include <memory>


typedef std::shared_ptr<nlohmann::json> Request_t ;
typedef std::shared_ptr<nlohmann::json> Config_t  ;
typedef std::shared_ptr<nlohmann::json> Result_t  ;
typedef std::shared_ptr<nlohmann::json> Json_t ;

class TTree;

// Base class defines common interface




class Composer {
public:
  
  
  Composer() : m_result(new nlohmann::json) {}; // Constructor
  virtual ~Composer() {}; // Destructor
  
  virtual void config(Config_t config) { m_config = config; }
  virtual void initialize(){};
  
  // Required: return true if we can satisfy the request.
  // If false, a new composer object will be instantiated to fulfill it.
  // Called only if the client specifically requests us.
  virtual bool can_satisfy(Request_t) {return false;};

  // Need only satify this:: it fills the output object. 
  virtual void satisfy_request(Request_t request, Result_t output);
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
  virtual Json_t get_or_compose(std::string jsonPointer);
  // May block.  May be put into a thread
  // Put a read lock on the data pointed to by the jsonPointer, wait until released,
  // See if there is data there. If not, upgrade to a write lock. Call compose() on that data.
  // Return when data available.

  virtual void compose(std::string jsonPointer, Result_t& result); 
  // Compose. should ONLY be called from get_or_compose. 
  // No mutex locking required at this stage: compose the result json object (or array or whatever)

  // Utility function for finding events in a TTree.
  // Returns an entry number, with event loaded.
  int64_t find_entry_in_tree(TTree* inTree, std::string& inSelection, int64_t inStart, int64_t inEnd, std::string& outError);
  
  typedef std::string  ConstituentAddress_t;  // Actually a jsonPointer
  struct Constituent_t{
    ConstituentAddress_t m_address;
    Result_t             m_data;
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
  Json_t         m_result;
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


