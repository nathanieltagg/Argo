#ifndef GALLERYCOMPOSER_CPP_92304BA2
#define GALLERYCOMPOSER_CPP_92304BA2



#include "Composer.h"


// class TTree;
class TLorentzVector;
struct GalleryAssociationHelper;

// namespace gallery{ class Event; }
// namespace art{ class InputTag; }
#include <gallery/Event.h>

// namespace recob { class Wire; }
// namespace raw   { class Digit; }

class GalleryComposer : public Composer{
public:
  GalleryComposer(); 
  virtual ~GalleryComposer(); 
  virtual void configure(Config_t config) ;
  
  virtual bool can_satisfy(Request_t) {return true;};

  virtual Output_t satisfy_request(Request_t request);

  // virtual Result_t composeManifestPart()
  
private:
  template<typename T> void     composeManifest(nlohmann::json& out);
  void composeManifest(nlohmann::json& out);

  template<typename T> bool composePiece(const std::string& type, const std::string& name, nlohmann::json& out );

  // virtual Json_t get_or_compose(std::string jsonPointer);
  //
  // virtual void compose(std::string jsonPointer, Result_t& result);
    
  // virtual bool event_matches() { return false; };    // locate event in provided coordinates.
  // virtual int load_event() { return 0; };    // locate event in provided coordinates.
  // virtual int build_manifest() { return 0; }; // Fill out header. Provide available elements marked with placeholders
  
  
protected:
  void  composeHeaderData(); // Does several things.

  // Does everything!
  template<typename T>
    void composeObject(const T&, nlohmann::json& out, const std::string& type="");

  // Specific override to do vectors of things
  template<typename TT> 
    void composeObject(const std::vector<TT>&v, nlohmann::json& out, const std::string& name="");

  // Everything except the image-building, which needs a bit more.
  template<typename T> 
    bool composePieceImage( const std::string& type, const std::string& name, nlohmann::json& out);
  template <typename T>
    void composeObjectImage(const std::vector<T>&v, const std::string& type, art::InputTag tag, nlohmann::json& out);
    
    

  // template <>
  // void composeObject(const std::vector<recob::Wire>&v, nlohmann::json& out, const std::string& type);
  // template <>
  // void composeObject(const std::vector<raw::Digit>&v, nlohmann::json& out, const std::string& type);

public:
  // Expose this to helper classses
  template<typename A, typename B> 
    void  composeAssociation();

protected:  
  // Utility functions.
  int         pointOffLine(const TLorentzVector& x0, const TLorentzVector& pv, const TLorentzVector& x, double tol);
 
  template<typename T> std::vector<std::pair<std::string,art::InputTag>>  findByType(TTree* fTree);
 
  // void composeHits();
  // void composeWires();
  // void composeRaw();
  void composeAssociations();
  
  std::vector<std::string> m_BranchNames;
  boost::mutex m_output_mutex;
  boost::mutex m_gallery_mutex;
  
  nlohmann::json  m_stats;
  double          m_event_time;
  
  
  Request_t   m_last_request;
  //configuration:
  bool        m_CreateSubdirCache;  
  std::string m_CacheStoragePath; 
  std::string m_CacheStorageUrl;
  std::string m_WorkingSuffix;
  std::string m_FinalSuffix;
  
  
  
  // Request things
  std::string m_options;
  std::string m_current_event_dir_name;
  std::string m_current_event_url;
  
  std::shared_ptr<gallery::Event>           m_Event;
  std::unique_ptr<GalleryAssociationHelper> m_assn_helper;
  
  
  // Current event:
 
};


#endif /* end of include guard: GALLERYCOMPOSER_CPP_92304BA2 */
