#ifndef GALLERYCOMPOSER_CPP_92304BA2
#define GALLERYCOMPOSER_CPP_92304BA2



#include "Composer.h"


// class TTree;
class TLorentzVector;
struct GalleryAssociationHelper;

// namespace gallery{ class Event; }
// namespace art{ class InputTag; }
#include <gallery/Event.h>

class GalleryComposer : public Composer{
public:
  GalleryComposer(); 
  virtual ~GalleryComposer(); 
  virtual void initialize();
  
  virtual bool can_satisfy(Request_t) {return true;};

  virtual Output_t satisfy_request(Request_t request);

  // virtual Result_t composeSkeletonPart()
  
private:
  template<typename T> void     composeSkeleton(nlohmann::json& out);
  void composeSkeleton(nlohmann::json& out);

  template<typename T> bool composePiece(const std::string& name,nlohmann::json& out );

  // virtual Json_t get_or_compose(std::string jsonPointer);
  //
  // virtual void compose(std::string jsonPointer, Result_t& result);
    
  // virtual bool event_matches() { return false; };    // locate event in provided coordinates.
  // virtual int load_event() { return 0; };    // locate event in provided coordinates.
  // virtual int build_skeleton() { return 0; }; // Fill out header. Provide available elements marked with placeholders
  
  
protected:
  void  composeHeaderData();
  void  composeHits();
  void  composeCalAvailability();
  void  composeRawAvailability();
  void  composeWires();
  void  composeRaw();
  void  composeAssociations();

  template<typename V>
    bool composeObjectsVector(const std::string& output_name, nlohmann::json& output);

  template<typename TT> 
    void composeObject(const std::vector<TT>&v, nlohmann::json& out);

  template<typename T>
    void composeObject(const T&, nlohmann::json& out);

public:
  // Expose this to helper classses
  template<typename A, typename B> 
    void  composeAssociation();

protected:  
  // Utility functions.
  int         pointOffLine(const TLorentzVector& x0, const TLorentzVector& pv, const TLorentzVector& x, double tol);
 
  template<typename T> std::vector<std::pair<std::string,art::InputTag>>  findByType(TTree* fTree);
 
 
  
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

  long long m_entry;
  std::string m_options;
  std::string m_current_event_dir_name;
  std::string m_current_event_url;
  
  std::shared_ptr<gallery::Event>           m_Event;
  std::unique_ptr<GalleryAssociationHelper> m_assn_helper;
  
  
  // Current event:
 
};


#endif /* end of include guard: GALLERYCOMPOSER_CPP_92304BA2 */
