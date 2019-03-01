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
  
  virtual void configure(Config_t config) { m_config = config;}
  
  // Required: return true if we can satisfy the request.
  // If false, a new composer object will be instantiated to fulfill it.
  // Called only if the client specifically requests us.
  // By default, it just reports if the filename matches.
  virtual bool can_satisfy(Request_t);

  // Need only satify this: 
  virtual Output_t satisfy_request(Request_t request);

 

  

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

  Config_t       m_config;  // The global config - things to be applied to every event, not just the current one.
  boost::mutex   m_mutex;   // local mutex, maybe useless?
  Request_t      m_request; // Place to store the request
  nlohmann::json m_result;  // Place to store all resulting data before transmission.
  std::string    m_cur_event_descriptor; // Unique string for this event. Usually something like pathname+entry or run|sub|event
  
  OutputCallback_t   m_output_callback;   // Link to event you call when you have some data to deliver.
  std::string        m_filename;          // Current filename, used by form_event_descriptor
  long long          m_entry;             // Current entry in file, used by form_event_descriptor

  float              m_progress_target;
  float              m_progress_so_far;

  // Utility function for finding events in a TTree.
  // Returns an entry number, with event loaded.
  int64_t find_entry_in_tree(TTree* inTree, std::string& inSelection, int64_t inStart, int64_t inEnd, std::string& outError);

  // Utility function for composing some monitoring data.
  virtual nlohmann::json monitor_data();

  // Utilty function for returning entire assembled event.
  virtual Output_t       dump_result() { Output_t o(new std::string("{\"record\":")); o->append(m_result.dump()); o->append("}"); return o; }
  
  // Utility function to report an error and no other data.
  static Output_t Error(const std::string& err); // {Error:err} as an Output_t

  static Output_t Done(); // {progress:1, state:"done"} as an Output_t

  // Utility function to create an event_descriptor, should be overriden by functions that don't use m_filename
  virtual std::string form_event_descriptor();

  // Utility function to provide progress feedback.
  void progress_made(const std::string msg="",float increment=1); // {progress: m_progress+=increment, state:msg} sent to callback.
  
  // Sends a piece off as part of an incremental output.  Wraps in a "piece" object.
  void dispatch_piece(const nlohmann::json& p);
  
  
  
  struct piece_t {
    std::string str;
    std::string type;
    std::string name;    
  };
  
  typedef std::list<piece_t> pieces_t;
  virtual bool parse_pieces(nlohmann::json& request, pieces_t& outPieces); // Return 'true' if a piece of some kind is requested, indicating that an incremental build has been requested.
  
  
  virtual bool dispatch_existing_pieces(pieces_t& ioPieces); // Look at each piece and see if something exists in the m_result that matches. if so, dispatch it.  Return true if everything could be satisfied. If not, return false and ioPieces contains undispatched items.
};


#endif 


