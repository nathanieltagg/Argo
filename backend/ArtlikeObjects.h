

#include <cstddef>
#include <vector>

namespace art {

// This is a total cheat class to hack into associations in a fast way.
class ProductID {
public:
  unsigned short processIndex_;
  unsigned short productIndex_;
};

class RefCore 
{
public:
  struct RefCoreTransients {
    // itemPtr_ is the address of the item for which the Ptr in which
    // this RefCoreTransients object resides is a pointer.
    void const * itemPtr_;    // transient
    void const * prodGetter_; // transient
  }; // RefCoreTransients
  ProductID id_;
  RefCoreTransients transients_;
};

class Assns {
public:
  typedef std::vector<std::pair<RefCore, size_t> > ptr_data_t; 
  ptr_data_t ptr_data_1_;
  ptr_data_t ptr_data_2_;
};

};

namespace {
  struct dictionary {
    std::pair<art::RefCore, size_t> prs;
    std::vector<std::pair<art::RefCore, size_t> > vprs;
  };
}  // namespace

